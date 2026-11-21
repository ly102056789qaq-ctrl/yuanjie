using System.Collections;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using UnityEngine;
using UnityEngine.Networking;
using UnityEngine.Playables;

public class BattleStage : MonoBehaviour
{
    [System.Serializable] public class Sheet { public int fw, fh, cols, frames, fps; public float size; public float[] anchor; public bool alpha; }
    [System.Serializable] public class Command { public string kind, node, effect, url, loopKey, motion, socket, target, tint; public Sheet sheet; public float height, scale, seconds, speed; public bool heavy; }
    private readonly Dictionary<string, Texture2D> atlases = new Dictionary<string, Texture2D>();
    private readonly HashSet<string> loading = new HashSet<string>();
    private readonly Dictionary<string, GameObject> loops = new Dictionary<string, GameObject>();
    private readonly HashSet<GameObject> activeFx = new HashSet<GameObject>();
    private Material effectMaterial;
    [DllImport("__Internal")] private static extern void BattleAnchor(string name, float x, float y, float height);
    private readonly Dictionary<string, SpriteRenderer> units = new Dictionary<string, SpriteRenderer>();
    private readonly Dictionary<string, Vector3> origins = new Dictionary<string, Vector3>();
    private Camera view;
    private SpriteRenderer backdrop;
    private readonly Dictionary<string,float> heights = new Dictionary<string,float>();
    private readonly Dictionary<string,LayerPerformer> performers = new Dictionary<string,LayerPerformer>();
    private static readonly Vector3 WideEye = new Vector3(.15f,3.05f,-11.5f);
    private static readonly Vector3 WideAim = new Vector3(.08f,1.45f,.3f);
    private Vector3 aim, cameraEye, eyeEnd, aimEnd, eyeVelocity, aimVelocity;
    private float shotDamping;
    private Vector3 impactOffset;
    private float impactAt;
    private const float WideFov=33;
    private Transform beam, beamHand, beamTarget;
    private float beamScale;
    private Vector3 beamContact;
    private PlayableDirector director;
    private SpriteRenderer targetRing;
    private Transform selected;
    private readonly Dictionary<string,ArenaBeast> arenaBeasts = new Dictionary<string,ArenaBeast>();
    private readonly Dictionary<string,BeastBolt> beastBolts = new Dictionary<string,BeastBolt>();
    private BattleMobaEffects moba;
    [DllImport("__Internal")] private static extern void BattleCut(int shot,float progress);

    private SpriteRenderer SpriteFor(string key, float height, float horizontal, float vertical, int order)
    {
        var texture = Resources.Load<Texture2D>("Battle/" + key);
        var obj = new GameObject(key);
        obj.transform.SetParent(transform);
        var renderer = obj.AddComponent<SpriteRenderer>();
        renderer.sprite = Sprite.Create(texture, new Rect(0, 0, texture.width, texture.height), new Vector2(.5f, 0), texture.height / height);
        renderer.sortingOrder = order;
        obj.transform.position = new Vector3(horizontal, vertical, 0);
        return renderer;
    }

    private BattleIllusionSea illusionSea;

    private void Start()
    {
        moba = new GameObject("Battle spell effects").AddComponent<BattleMobaEffects>();
        moba.transform.SetParent(transform, false);
        view = new GameObject("Battle camera").AddComponent<Camera>();
        view.tag = "MainCamera";
        view.depthTextureMode |= DepthTextureMode.Depth;
        view.fieldOfView=WideFov;
        view.clearFlags=CameraClearFlags.SolidColor;
        view.backgroundColor=new Color(.09f,.15f,.25f);
        MoveTo(WideEye,WideAim,0);
        effectMaterial = new Material(Resources.Load<Shader>("FxAdd"));
        backdrop = SpriteFor("Backdrop", 31, 0, -13,-100);
        backdrop.transform.position=new Vector3(0,-13,26);
        IceArena.Build(transform,backdrop,WideEye);
        illusionSea = new GameObject("Illusion Sea effects").AddComponent<BattleIllusionSea>();
        illusionSea.transform.SetParent(transform, false);
        illusionSea.Initialize(backdrop, view);
        bool frostfire = Application.absoluteURL.Contains("squad=frostfire");
        var party = frostfire ? new[] {"Shen", "Rin", "Eliot", "Siwei"} : new[] {"Siwei", "Dekeke", "Vera", "Rin"};
        var custom = System.Text.RegularExpressions.Regex.Match(Application.absoluteURL, @"[?&]lineup=([a-z-]+)(?:&|$)");
        if (custom.Success) {
            var names = new Dictionary<string,string> {{"shen","Shen"},{"rin","Rin"},{"eliot","Eliot"},{"siwei","Siwei"},{"vera","Vera"},{"dekeke","Dekeke"},{"daier","Daier"},{"liselotte","Liselotte"}};
            var ids = custom.Groups[1].Value.Split('-');
            if (ids.Length == 4 && new HashSet<string>(ids).Count == 4 && System.Array.TrueForAll(ids, names.ContainsKey))
                party = System.Array.ConvertAll(ids, id => names[id]);
        }
        AddUnit("Ally_" + party[0], 2.85f, 1.20f, -.42f, 3);
        AddUnit("Ally_" + party[1], 2.71f, 2.64f, 1.38f, 2);
        AddUnit("Ally_" + party[2], 2.95f, 3.16f, -.85f, 5);
        AddUnit("Ally_" + party[3], 2.79f, 4.61f, .87f, 2);
        AddUnit("Enemy_A", 2.36f, -1.64f, -.72f, 4, "06");
        AddUnit("Enemy_B", 2.21f, -4.25f, .68f, 2, "02");
        AddUnit("Enemy_C", 3.00f, -3.47f, 4.9f, 1, "04");
        targetRing=IceArena.Decal(transform,"Ring",Vector3.zero,2.85f,2.10f,1);
        targetRing.enabled=false;
        director=GetComponent<PlayableDirector>();
        director.stopped+=EndCine;
    }

    private void AddUnit(string key, float height, float horizontal, float vertical, int order, string beastNumber = null)
    {
        var unit = new GameObject(key).AddComponent<SpriteRenderer>();
        unit.transform.SetParent(transform,false);
        unit.transform.position=new Vector3(horizontal,0,vertical);
        heights[key]=height;
        if(key.StartsWith("Ally_")) {
            var body=new GameObject("Performer"); body.transform.SetParent(unit.transform,false);
            var rig=body.AddComponent<LayerPerformer>(); rig.Assemble(key.Substring(5).ToLowerInvariant(),height,order);
            performers.Add(key,rig);
        } else {
            var template = Resources.Load<ArenaBeast>("ArenaBeasts/Beast" + beastNumber);
            var actor = Instantiate(template, unit.transform);
            arenaBeasts.Add(key, actor);
            actor.ResetPose();
            if (beastNumber == "02" || beastNumber == "04") {
                var bolt = new GameObject(key + " Bolt").AddComponent<BeastBolt>();
                bolt.transform.SetParent(transform,false);
                bolt.Setup(effectMaterial, beastNumber == "04");
                beastBolts.Add(key,bolt);
            }
        }
        float shadowWidth = beastNumber == null ? 1.25f : beastNumber == "04" ? 2.8f : 1.85f;
        IceArena.Decal(unit.transform,"Shadow",Vector3.up*.009f,shadowWidth,shadowWidth*.47f,-3);
        units.Add(key, unit);
        origins.Add(key, unit.transform.position);
    }

    private void LateUpdate()
    {
        if (!view) return;
        if(director.state!=PlayState.Playing) {
            var eye = Vector3.SmoothDamp(cameraEye,eyeEnd,ref eyeVelocity,shotDamping);
            var focus = Vector3.SmoothDamp(aim,aimEnd,ref aimVelocity,shotDamping);
            Pose(eye,focus);
            float elapsed = Time.unscaledTime - impactAt;
            if (elapsed < .18f) {
                float decay = 1 - elapsed / .18f;
                view.transform.position += impactOffset * (Mathf.Cos(elapsed * 54) * decay * decay);
            }
        }
        if (beam && beamHand && beamTarget) {
            var rotation = Quaternion.LookRotation(beamTarget.position + beamContact - beamHand.position);
            beam.SetPositionAndRotation(beamHand.position - rotation * Vector3.up * (2.5f * beamScale), rotation);
        }
        if (selected) targetRing.transform.position=selected.position+Vector3.up*.018f;
#if UNITY_WEBGL && !UNITY_EDITOR
        foreach (var entry in units) {
            var foot = view.WorldToViewportPoint(entry.Value.transform.position);
            var top=view.WorldToViewportPoint(entry.Value.transform.position+Vector3.up*heights[entry.Key]);
            BattleAnchor(entry.Key, foot.x, 1-foot.y, top.y-foot.y);
            BattleHud.Track(entry.Key, foot.x, 1-foot.y, top.y-foot.y);
        }
#endif
    }

    public void Perform(string json)
    {
        var command = JsonUtility.FromJson<Command>(json);
        units.TryGetValue(command.node ?? "", out var unit);
        if (command.kind == "reset") illusionSea.Clear();
        switch (command.kind) {
            case "illusionSea": illusionSea.SetField(command.heavy); break;
            case "specialNumber":
                if (unit) illusionSea.Number(command.effect, unit.transform.position + Vector3.up * heights[unit.name] * .63f + Vector3.back * .44f, Mathf.RoundToInt(command.scale), command.speed, command.tint);
                break;
            case "warm": StartCoroutine(LoadAtlas(command)); break;
            case "prepareSpell": moba.Prepare(command.effect); break;
            case "finishPreparation": moba.FinishPreparation(); break;
            case "lightning":
                if (unit) moba.Lightning(unit.transform.position, command.speed);
                break;
            case "vine":
                if (unit) moba.Vine(unit.transform.position, command.speed);
                break;
            case "spell":
                if (unit) {
                    var position = unit.transform.position + Vector3.up * (heights[unit.name] * command.height);
                    position += Vector3.back * (unit.name == "Enemy_A" ? .65f : .12f);
                    if (command.socket == "hand" && performers.TryGetValue(unit.name, out var performer) && performer.CastHand)
                        position = performer.CastHand.position;
                    if (command.socket == "party") {
                        var center = Vector3.zero;
                        int count = 0;
                        foreach (var ally in performers.Keys) {
                            if (!units[ally].gameObject.activeSelf) continue;
                            center += units[ally].transform.position;
                            count++;
                        }
                        if (count > 0) position = center / count + Vector3.up * .07f;
                    }
                    var rotation = Quaternion.identity;
                    bool followsHand = command.socket == "beam" && performers.ContainsKey(command.target ?? "");
                    if (followsHand && units.TryGetValue(command.target, out var beamCaster)) {
                        var origin = beamCaster.transform.position + Vector3.up * heights[beamCaster.name] * .62f;
                        beamHand = performers[beamCaster.name].CastHand;
                        if (beamHand) origin = beamHand.position;
                        beamTarget = unit.transform;
                        beamContact = position - beamTarget.position;
                        beamScale = command.scale;
                        rotation = Quaternion.LookRotation(position - origin);
                        // The purchased beam's emitter sits 2.5 local units above its pivot.
                        position = origin - rotation * Vector3.up * (2.5f * command.scale);
                    }
                    var spawned = moba.Spell(command.effect, position, command.scale, command.seconds, command.speed, rotation);
                    if (followsHand && spawned) beam = spawned.transform;
                }
                break;
            case "projectile": case "iceShot": case "musicShot":
                if (unit && units.TryGetValue(command.target, out var receiver)) {
                    string element = command.kind == "projectile" ? command.effect : command.kind == "musicShot" ? "music" : "ice";
                    var start = unit.transform.position + new Vector3(.35f,1.81f,-.26f);
                    if (performers.TryGetValue(unit.name,out var shooter) && shooter.CastHand) start = shooter.CastHand.position;
                    var ground = receiver.transform.position;
                    var contact = ground + Vector3.up * (heights[receiver.name] * .55f) + Vector3.back * (receiver.name == "Enemy_A" ? .9f : .14f);
                    float duration = command.seconds > 0 ? command.seconds : element == "music" ? .70f : .48f;
                    if (command.kind == "iceShot" && beastBolts.TryGetValue(unit.name,out var bolt)) {
                        start = unit.transform.position + Vector3.up*heights[unit.name]*.82f + new Vector3(.50f,0,-.30f);
                        bolt.Fire(start, contact, duration, command.speed > 0 ? command.speed : 1);
                    } else moba.Launch(element, start, contact, ground, duration, command.speed);
                }
                break;
            case "discharge":
                if(performers.TryGetValue(command.node,out var caster) && units.TryGetValue(command.target,out var victim)) {
                    var contact=victim.transform.position+Vector3.up*(heights[victim.name]*.52f)+Vector3.back*(victim.name=="Enemy_A"?.95f:.15f);
                    IonDischarge.Play(caster.CastHand,contact,effectMaterial,command.speed);
                }
                break;
            case "fx": if (unit && command.sheet != null) StartCoroutine(PlayFx(command, unit)); break;
            case "stopLoop": if (loops.TryGetValue(command.loopKey, out var loop)) { loops.Remove(command.loopKey); activeFx.Remove(loop); Destroy(loop); } break;
            case "base": MoveTo(WideEye,WideAim,command.seconds); break;
            case "enemies": MoveTo(new Vector3(-.54f,2.76f,-10.25f),new Vector3(-1.56f,1.36f,.25f),command.seconds); break;
            case "close": case "low":
                if(unit) {
                    var pos=unit.transform.position;
                    // Leave space on the attacking side for the wrist and the target.
                    var focus = new Vector3(pos.x*.64f-.62f, heights[unit.name]*.54f, pos.z*.55f);
                    MoveTo(focus+new Vector3(.38f,1.01f,-7.85f),focus,command.seconds);
                }
                break;
            case "act":
                if(performers.TryGetValue(command.node,out var rig)) rig.Act(command.motion,command.speed>0?command.speed:1,command.seconds);
                else if(unit && arenaBeasts.TryGetValue(unit.name,out var attacker)) attacker.React("Attack",command.speed);
                else if(unit) StartCoroutine(Pulse(unit,false));
                break;
            case "target": selected=unit?unit.transform:null; targetRing.enabled=selected!=null; break;
            case "cine":
                if (director.state != PlayState.Playing) {
                    float rate = command.speed > 0 ? command.speed : 1;
                    performers["Ally_Rin"].Act("cast", rate);
                    director.time = 0;
                    director.Play();
                    director.playableGraph.GetRootPlayable(0).SetSpeed(rate);
                }
                break;
            case "hit":
                if (unit && command.scale > 0 && director.state != PlayState.Playing) {
                    float side = view.WorldToViewportPoint(unit.transform.position).x < .5f ? -1 : 1;
                    impactOffset = (view.transform.right * side + view.transform.up * .23f + view.transform.forward * .35f) * Mathf.Min(.095f,command.scale);
                    impactAt = Time.unscaledTime;
                }
                if (unit && performers.TryGetValue(unit.name,out var struck)) struck.Recoil(command.speed>0?command.speed:1);
                if(unit && arenaBeasts.TryGetValue(unit.name,out var victimBeast)) victimBeast.React("Hit",command.speed);
                else if(unit) StartCoroutine(Pulse(unit,true));
                break;
            case "die":
                if (unit && arenaBeasts.TryGetValue(unit.name,out var fallen)) fallen.React("Death",command.speed);
                else if (unit) unit.gameObject.SetActive(false);
                break;
            case "reset": moba.Clear(); if(director.state==PlayState.Playing) director.Stop(); foreach (var item in activeFx) Destroy(item); activeFx.Clear(); loops.Clear(); MoveTo(WideEye,WideAim,0); foreach (var item in units) { item.Value.gameObject.SetActive(true); item.Value.transform.position=origins[item.Key]; } foreach (var actor in arenaBeasts.Values) actor.ResetPose(); break;
        }
    }

    private IEnumerator LoadAtlas(Command command)
    {
        if (atlases.ContainsKey(command.effect)) yield break;
        if (!loading.Add(command.effect)) { while (loading.Contains(command.effect)) yield return null; yield break; }
        using (var request = UnityWebRequestTexture.GetTexture(command.url, true)) {
            yield return request.SendWebRequest();
            if (request.result == UnityWebRequest.Result.Success) atlases[command.effect] = DownloadHandlerTexture.GetContent(request);
            else Debug.LogWarning(command.effect + ": " + request.error);
        }
        loading.Remove(command.effect);
    }

    private IEnumerator PlayFx(Command command, SpriteRenderer unit)
    {
        bool looping = !string.IsNullOrEmpty(command.loopKey);
        if (looping && loops.ContainsKey(command.loopKey)) yield break;
        var effect = new GameObject(command.effect);
        effect.transform.SetParent(unit.transform, false);
        activeFx.Add(effect);
        if (looping) loops[command.loopKey] = effect;
        yield return LoadAtlas(command);
        if (!effect) yield break;
        if (atlases.TryGetValue(command.effect, out var texture)) {
            var sheet = command.sheet;
            var renderer = effect.AddComponent<SpriteRenderer>();
            if (!sheet.alpha) renderer.sharedMaterial = effectMaterial;
            if(ColorUtility.TryParseHtmlString(command.tint??"",out var tint)) renderer.color=tint;
            renderer.sortingOrder = 20;
            if(command.socket=="hand" && performers.TryGetValue(unit.name,out var actor) && actor.CastHand) {
                effect.transform.SetParent(actor.CastHand,false);
                effect.transform.localPosition=Vector3.back*.15f;
            } else effect.transform.localPosition = Vector3.up * heights[unit.name] * command.height + Vector3.back*(unit.name=="Enemy_A"?1.12f:.12f);
            float pixels = Mathf.Max(sheet.fw, sheet.fh) / Mathf.Max(.01f, sheet.size * command.scale);
            var frames = new Sprite[sheet.frames];
            for (int index = 0; index < frames.Length; index++) {
                var rect = new Rect(index % sheet.cols * sheet.fw, texture.height - (1 + index / sheet.cols) * sheet.fh, sheet.fw, sheet.fh);
                frames[index] = Sprite.Create(texture, rect, new Vector2(sheet.anchor[0], sheet.anchor[1]), pixels, 0, SpriteMeshType.FullRect);
            }
            float start = Time.time;
            while (effect) {
                int frame = (int)((Time.time - start) * sheet.fps);
                if (!looping && frame >= frames.Length) break;
                renderer.sprite = frames[frame % frames.Length];
                yield return null;
            }
            foreach (var frame in frames) Destroy(frame);
        }
        if (effect) { if (looping) loops.Remove(command.loopKey); activeFx.Remove(effect); Destroy(effect); }
    }

    private IEnumerator Pulse(SpriteRenderer unit, bool impact)
    {
        var origin = origins[unit.name];
        var direction = origin.x > 0 ? -1 : 1;
        for (float elapsed = 0; elapsed < .25f; elapsed += Time.deltaTime) {
            float pulse = Mathf.Sin(Mathf.PI * elapsed / .25f);
            unit.transform.position = origin + Vector3.right * direction * pulse * (impact ? -.17f : .22f);
            if (impact && performers.TryGetValue(unit.name,out var performer)) performer.Tint(pulse);
            yield return null;
        }
        unit.transform.position = origin;
        if (performers.TryGetValue(unit.name,out var rig)) rig.Tint(0);
    }

    private void Pose(Vector3 eye,Vector3 focus) { cameraEye=eye; view.transform.position=eye; aim=focus; view.transform.LookAt(focus); }
    private void MoveTo(Vector3 eye,Vector3 focus,float duration) {
        eyeEnd=eye; aimEnd=focus;
        shotDamping=Mathf.Max(.20f,duration*.38f);
        if(duration<=0) {eyeVelocity=aimVelocity=Vector3.zero; Pose(eye,focus);}
    }
    private void EndCine(PlayableDirector source) {
        MoveTo(WideEye,WideAim,0);
#if UNITY_WEBGL && !UNITY_EDITOR
        BattleCut(-1,1);
#endif
    }
    public void CineFrame(int beat,float progress) {
        if(!view) return;
        var rin=origins["Ally_Rin"];
        float weight=Mathf.SmoothStep(0,1,progress);
        var partyEye=new Vector3(3.38f,2.32f,-7.4f); var partyAim=new Vector3(2.65f,1.38f,.35f);
        if(beat==0) Pose(Vector3.Lerp(WideEye,rin+new Vector3(.92f,2.12f,-4.96f),weight),Vector3.Lerp(WideAim,rin+Vector3.up*1.86f,weight));
        if(beat==3) Pose(partyEye,partyAim);
        if(beat==4) Pose(Vector3.Lerp(partyEye,WideEye,weight),Vector3.Lerp(partyAim,WideAim,weight));
#if UNITY_WEBGL && !UNITY_EDITOR
        BattleCut(beat,progress);
#endif
    }
}
