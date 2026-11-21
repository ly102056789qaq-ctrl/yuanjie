using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;

public sealed class LayerPerformer : MonoBehaviour
{
    [Serializable] private class Rig { public float height; public Part[] parts; }
    [Serializable] private class HeldItem {
        public string image;
        public float pivotX, pivotY, offsetX, offsetY, scale, angle;
    }
    [Serializable] private class Part { public string key, group, deform, image; public float px, py, dx, dy; public HeldItem held; }
    private class Joint { public Transform pivot; public Vector3 rest; public string group, deform; public ArmSkin arm; public HairSkin hair; }
    private readonly List<Joint> joints = new List<Joint>();
    private readonly List<SpriteRenderer> layers = new List<SpriteRenderer>();
    private readonly List<WeightedArt> fittedClothes = new List<WeightedArt>();
    public Transform CastHand { get; private set; }
    private readonly AnimationCurve cast = Curve(0,0, .15f,6, .43f,-25, .68f,-48, .84f,-43, 1.09f,-39, 1.50f,-12, 1.78f,2, 1.9f,0);
    private readonly AnimationCurve attack = Curve(0,0, .10f,7, .22f,-20, .34f,-46, .44f,-41, .65f,-26, .92f,3, 1.12f,0);
    private readonly AnimationCurve castWeight = Curve(0,0, .14f,-.65f, .40f,.25f, .65f,1, .86f,.82f, 1.16f,.55f, 1.59f,-.14f, 1.85f,0);
    private readonly AnimationCurve attackWeight = Curve(0,0, .10f,-.78f, .28f,1, .43f,.76f, .67f,.27f, .90f,-.15f, 1.10f,0);
    private readonly AnimationCurve elbowAttack = Curve(0,0, .085f,-12, .19f,-47, .32f,-17, .38f,-8, .61f,-23, .93f,-4, 1.12f,0);
    private readonly AnimationCurve wristAttack = Curve(0,0, .13f,12, .25f,16, .36f,-15, .48f,-8, .75f,7, 1.12f,0);
    private readonly Color resting = new Color(.93f,.95f,1);
    private AnimationCurve motion;
    private readonly AnimationCurve elbowCast = Curve(0,0,.12f,-5,.33f,-49,.55f,-54,.74f,-13,1f,-16,1.5f,-5,1.9f,0);
    private readonly AnimationCurve wristCast = Curve(0,0,.23f,11,.50f,18,.70f,-17,.95f,-7,1.44f,5,1.9f,0);
    private readonly AnimationCurve ward = Curve(0,0,.15f,.05f,.45f,.75f,.67f,1,.91f,.96f,1.15f,.89f,1.64f,.09f,1.9f,0);
    private bool castsWithBothHands;
    private bool usesDanceArms;
    private static readonly AnimationCurve danceShoulder = Curve(0,0, .10f,-4, .24f,-19, .38f,-35, .50f,-41, .63f,-38, .84f,-16, 1,0);
    private static readonly AnimationCurve danceElbow = Curve(0,0, .14f,19, .27f,30, .46f,28, .58f,23, .78f,18, .90f,12, 1,0);
    private static readonly AnimationCurve danceWrist = Curve(0,0, .16f,11, .29f,22, .44f,18, .57f,-5, .67f,-8, .84f,12, 1,0);
    private static readonly AnimationCurve danceFingers = Curve(0,0, .21f,5, .40f,11, .57f,4, .66f,-10, .82f,-3, 1,0);
    private static readonly AnimationCurve toePrep = Curve(0,0,.12f,1,.36f,0);
    private static readonly AnimationCurve toePoint = Curve(0,0,.15f,0,.38f,1,.48f,.90f,.79f,.22f,1.08f,0);
    private static readonly AnimationCurve curtain = Curve(0,0,.24f,.08f,.72f,1,.98f,.94f,1.38f,.32f,1.84f,0);
    private static readonly AnimationCurve gather = Curve(0,0,.30f,1,.47f,.94f,.78f,.06f,1.14f,0);
    private static readonly AnimationCurve silence = Curve(0,0,.33f,.06f,.75f,1,1.09f,1,1.43f,.55f,1.88f,0);
    private bool danceFinale;
    private bool beamGesture;
    private float sustain;
    private float hitStart = float.NegativeInfinity, hitRate, hitFrom, hitAmount;
    private float start, height, offset, playbackRate=1;
    private float reach, fold, lean, castTempo;
    private float breathPeriod, stancePeriod, restingElbow, assistingElbow;
    private WeightedArt legs;
    private DanceGown danceGown;
    private Transform hips, spine;
    private Vector3 hipsRest;

    private static AnimationCurve Curve(params float[] values)
    {
        var keys = new Keyframe[values.Length/2];
        for (int index=0; index<keys.Length; index++) keys[index]=new Keyframe(values[index*2],values[index*2+1]);
        var curve = new AnimationCurve(keys);
        for (int index=1; index<keys.Length-1; index++) {
            float incoming = keys[index].value - keys[index-1].value;
            float outgoing = keys[index+1].value - keys[index].value;
            if (incoming * outgoing > 0) curve.SmoothTangents(index, 0);
        }
        return curve;
    }

    public void Assemble(string actor, float worldHeight, int order)
    {
        height = worldHeight;
        castsWithBothHands = actor == "dekeke";
        usesDanceArms = actor == "daier";
        (reach, fold, lean, castTempo) = actor switch {
            "vera" => (1.10f, .85f, 1.16f, 1.04f),
            "rin" => (.78f, .88f, .65f, .90f),
            "dekeke" => (.86f, .98f, .84f, .97f),
            "shen" => (.92f, .80f, .94f, 1.02f),
            "eliot" => (.83f, .87f, .74f, .94f),
            _ => (.96f, 1.13f, 1.00f, 1.00f)
        };
        offset = transform.position.x;
        (breathPeriod, stancePeriod, restingElbow, assistingElbow) = actor switch {
            "vera" => (3.35f, 5.2f, 19f, 5f),
            "rin" => (4.25f, 6.8f, 8f, 12f),
            "dekeke" => (3.12f, 4.8f, 13f, 17f),
            "shen" => (3.90f, 6.2f, 8f, 4f),
            "eliot" => (4.18f, 6.7f, 8f, 5f),
            _ => (3.85f, 6.1f, 16f, 7f)
        };
        gameObject.AddComponent<SortingGroup>().sortingOrder = order;
        string folder = "Stage/" + actor + "/";
        var rig = JsonUtility.FromJson<Rig>(Resources.Load<TextAsset>(folder+"rig").text);
        int layerSpacing = Array.Exists(rig.parts,p => !string.IsNullOrEmpty(p.held?.image)) ? 2 : 1;
        float pixels = rig.height / height;
        Vector3 Anchor(string group) {
            var anchor = Array.Find(rig.parts, item => item.group == group);
            return new Vector3(anchor.px, anchor.py, 0) / pixels;
        }
        hipsRest = Anchor("hip");
        float hipHeightPixels = hipsRest.y * pixels;
        hips = new GameObject("Pelvis").transform;
        hips.SetParent(transform, false);
        hips.localPosition = hipsRest;
        spine = new GameObject("Spine").transform;
        spine.SetParent(hips, false);
        spine.localPosition = Anchor("chest") - hipsRest;
        foreach (var part in rig.parts) {
            var pivot = new GameObject(part.key).transform;
            var parent = part.group == "legs" ? transform : part.group == "hip" ? hips : spine;
            pivot.SetParent(parent,false);
            var anchor = new Vector3(part.px,part.py,0)/pixels;
            pivot.localPosition = parent.InverseTransformPoint(transform.TransformPoint(anchor));
            var texture = Resources.Load<Texture2D>(folder+(string.IsNullOrEmpty(part.image) ? part.key : part.image));
            var joint=new Joint {pivot=pivot,rest=pivot.localPosition,group=part.group,deform=part.deform};
            int orderInBody=joints.Count*layerSpacing;
            joints.Add(joint);
            if (part.deform == "dance_gown") {
                var origin = anchor + new Vector3(part.dx,part.dy,0)/pixels;
                danceGown = new DanceGown(transform, hips, texture, origin, pixels, height, orderInBody);
                continue;
            }
            if (part.deform == "fitted_bodice" || part.deform == "fitted_skirt") {
                bool bodice = part.deform == "fitted_bodice";
                BoneWeight WaistWeights(Vector2 uv) {
                    float aboveHip = (part.py + part.dy + uv.y*texture.height - hipHeightPixels) / rig.height;
                    // Both garment edges lie in the rigid pelvis band. The
                    // bodice flexes above the belt and the skirt below it.
                    float free = bodice ? Mathf.InverseLerp(.092f,.17f,aboveHip)
                                        : Mathf.InverseLerp(.012f,.108f,-aboveHip);
                    return WeightedArt.Blend(0,1,Mathf.SmoothStep(0,1,free));
                }
                var origin = anchor - hipsRest + new Vector3(part.dx,part.dy,0)/pixels;
                fittedClothes.Add(new WeightedArt(part.key,hips,texture,origin,pixels,
                    orderInBody,new[] {hips,pivot},WaistWeights,6,32));
                continue;
            }
            if (part.deform == "long_hair_front" || part.deform == "long_hair_back") {
                joint.hair = new HairSkin(pivot,texture,new Vector3(part.dx,part.dy,0)/pixels,pixels,
                    part.deform == "long_hair_front",orderInBody);
                continue;
            }
            if (part.group == "legs") {
                var origin = new Vector3(part.dx,part.dy,0)/pixels;
                legs = new WeightedArt(actor+" planted legs", pivot, texture, origin, pixels, orderInBody,
                    new[] {transform, hips}, uv => WeightedArt.Blend(0,1,Mathf.SmoothStep(0,1,Mathf.InverseLerp(.12f,.92f,uv.y))));
                continue;
            }
            if(part.group=="arm_r" || part.group=="arm_l") {
                joint.arm=new ArmSkin(pivot,texture,new Vector3(part.dx,part.dy,0)/pixels,pixels,part.group=="arm_r",actor,orderInBody);
                if(part.group=="arm_r") CastHand=joint.arm.Wrist;
                if (!string.IsNullOrEmpty(part.held?.image))
                    AttachHeldItem(part.held,joint.arm.Wrist,folder,pixels,orderInBody-1);
                continue;
            }
            var image = new GameObject("Art").AddComponent<SpriteRenderer>();
            image.transform.SetParent(pivot,false);
            image.transform.localPosition = new Vector3(part.dx,part.dy,0)/pixels;
            image.sprite = Sprite.Create(texture,new Rect(0,0,texture.width,texture.height),Vector2.zero,pixels,0,SpriteMeshType.FullRect);
            image.sortingOrder = orderInBody;
            image.color=resting;
            layers.Add(image);
        }
    }

    private void AttachHeldItem(HeldItem item,Transform wrist,string folder,float pixels,int order) {
        var art=Resources.Load<Texture2D>(folder+item.image);
        var renderer=new GameObject(item.image).AddComponent<SpriteRenderer>();
        renderer.transform.SetParent(wrist,false);
        renderer.transform.localPosition=new Vector3(item.offsetX,item.offsetY,0)/pixels;
        renderer.transform.localRotation=Quaternion.Euler(0,0,item.angle);
        renderer.sprite=Sprite.Create(art,new Rect(0,0,art.width,art.height),
            new Vector2(item.pivotX,item.pivotY),pixels/item.scale,0,SpriteMeshType.FullRect);
        renderer.sortingOrder=order;
        renderer.color=resting;
        layers.Add(renderer);
    }

    public void Act(string action,float speed=1,float actionLength=0) {
        motion = action == "attack" ? attack : cast;
        beamGesture = usesDanceArms && action == "release";
        danceFinale = usesDanceArms && (action == "ultimate" || beamGesture);
        sustain = usesDanceArms && motion == cast ? Mathf.Max(0,actionLength-1.9f) : 0;
        playbackRate=Mathf.Clamp(speed,.25f,4f);
        start=Time.time;
    }

    public void Recoil(float speed) {
        if (!usesDanceArms) return;
        hitFrom=hitAmount;
        hitStart=Time.time;
        hitRate=Mathf.Clamp(speed,.25f,4f);
    }
    public void Tint(float amount) {
        var color=Color.Lerp(resting,new Color(.65f,.55f,1),amount);
        foreach(var part in layers) part.color=color;
        foreach(var joint in joints) { joint.arm?.Tint(color); joint.hair?.Tint(color); }
        foreach(var garment in fittedClothes) garment.Tint(color);
        legs?.Tint(color);
        danceGown?.Tint(color);
    }

    private void Update() => PoseAt(Time.time,Time.deltaTime);
    private void PoseAt(float now,float deltaTime)
    {
        float clock=(now+offset)*Mathf.PI*2/breathPeriod;
        float breath=Mathf.Sin(clock);
        float stance=(now+offset*1.7f)*Mathf.PI*2/stancePeriod;
        float shift=Mathf.Sin(stance+.23f*Mathf.Sin(clock*.47f));
        float trailing=Mathf.Sin(clock-.82f);
        float elapsed=(now-start)*playbackRate;
        bool casting = motion == cast;
        float phase = casting ? elapsed * castTempo : elapsed;
        // Lengthen the open gesture over the live particle cue, then use the
        // original recovery keys. Keep moving through that interval.
        if (sustain>0 && phase>.68f) {
            float extended = .42f+sustain;
            phase = phase < .68f+extended ? .68f+(phase-.68f)*.42f/extended : phase-sustain;
        }
        float duration = casting ? 1.9f : 1.12f;
        float idle = motion == null ? 1 : 1 - Mathf.SmoothStep(0,1,Mathf.Clamp01(phase/.16f)) *
            (1-Mathf.SmoothStep(0,1,Mathf.InverseLerp(duration-.38f,duration,phase)));
        float sway=shift*idle;
        float rightSwing=idle*(.62f*Mathf.Sin(stance-.42f)+.38f*Mathf.Sin(clock-.36f));
        float leftSwing=idle*(.63f*Mathf.Sin(stance+.77f)+.37f*Mathf.Sin(clock-1.13f));
        float gesture=motion==null ? 0 : motion.Evaluate(phase)*reach;
        var weightCurve = casting ? castWeight : attackWeight;
        float weight = motion == null ? 0 : weightCurve.Evaluate(phase) * lean;
        float follow = motion == null ? 0 : weightCurve.Evaluate(Mathf.Max(0, phase-.09f)) * lean;
        float settle = follow-weight;
        bool dancing = usesDanceArms && motion != null;
        float prep = dancing && !casting ? toePrep.Evaluate(phase) : 0;
        float point = dancing && !casting ? toePoint.Evaluate(phase) : 0;
        float open = dancing && casting && !danceFinale ? curtain.Evaluate(phase) : 0;
        float draw = danceFinale ? gather.Evaluate(phase) : 0;
        float hold = danceFinale ? silence.Evaluate(phase) : 0;
        float breathingThroughCast = usesDanceArms && casting ? .42f*(1-idle) : 0;
        if (usesDanceArms && now >= hitStart && hitRate > 0) {
            float t = (now-hitStart)*hitRate;
            hitAmount = t < .105f ? Mathf.SmoothStep(hitFrom,1,t/.105f)
                                  : 1-Mathf.SmoothStep(0,1,(t-.105f)/.39f);
        }
        float dip = .009f*prep+.008f*draw+.007f*hitAmount;
        float inclination = 2.7f*prep-3.6f*point-2.4f*open+2.5f*draw-3.2f*hold-5.2f*hitAmount;
        hips.localPosition = hipsRest + height * new Vector3(.012f*sway-.0085f*weight, .0034f*breath*idle-.004f*Mathf.Abs(weight), 0);
        if (usesDanceArms) hips.localPosition += height * new Vector3(-.016f*point+.009f*prep-.012f*open-.013f*hold, -dip+.007f*point+.005f*hold+.003f*breath*breathingThroughCast, 0);
        hips.localRotation = Quaternion.Euler(0,0,1.8f*sway-1.35f*weight);
        spine.localRotation = Quaternion.Euler(0,0,4.9f*weight-2.55f*sway+.80f*breath*idle+inclination);
        danceGown?.Pose(clock,stance,idle+breathingThroughCast,follow+.24f*(point+open+hold),settle);
        float wardLift=castsWithBothHands && casting ? ward.Evaluate(phase) : 0;
        foreach (var part in joints) {
            float angle=0, lift=0, stretch=1;
            switch(part.group) {
                case "arm_r": angle=gesture-4.1f*rightSwing; lift=.003f*breath*idle; break;
                case "arm_l": angle=-gesture*.10f+3.7f*leftSwing; lift=.0028f*trailing*idle; break;
                case "head": case "earrings": angle=1.25f*sway+.85f*trailing*idle-2.2f*weight+1.5f*settle; lift=.0027f*breath*idle; break;
                case "chest": case "torso": case "cape": stretch+=.004f*breath*idle; break;
            }
            if(part.deform=="hair" || part.group=="earrings") angle+=1.35f*Mathf.Sin(clock-1.4f)*idle+2.8f*settle;
            if (part.group=="head") angle+=.9f*point+2.2f*hold+3.2f*hitAmount;
            if(part.deform=="skirt" || part.deform=="fitted_skirt") angle+=.88f*Mathf.Sin(stance-.65f)*idle+1.65f*settle;
            if (part.hair != null)
                part.hair.Pose(clock,angle+5.5f*weight-.14f*gesture,deltaTime);
            if (usesDanceArms && part.arm != null) {
                float t = motion == null ? 0 : Mathf.Clamp01(phase/duration);
                float amplitude = casting ? 1 : .73f;
                bool lead = part.group == "arm_r";
                float shoulder = danceShoulder.Evaluate(t) * amplitude;
                float elbow = danceElbow.Evaluate(t) * amplitude;
                float wrist = danceWrist.Evaluate(t) * amplitude;
                float fingers = danceFingers.Evaluate(t) * amplitude;
                // The supporting hand gathers toward the waist while the lead
                // elbow opens. Flexion also brings the forearm towards camera.
                angle = lead ? shoulder-2.5f*rightSwing : -.34f*shoulder+2*leftSwing;
                lift += (lead ? .006f : .002f) * (-shoulder/67f);
                float bend = lead ? elbow+3*idle : 1.04f*shoulder-.32f*elbow-3*idle;
                float forward = lead ? .74f*elbow-.09f*shoulder : -.42f*shoulder;
                float hand = lead ? wrist : -.42f*wrist;
                float tips = lead ? fingers : -.4f*fingers;
                if (dancing && !casting) {
                    angle = (lead ? 9*prep-55*point : 14*point) + (lead ? -2.5f*rightSwing : 2*leftSwing);
                    bend = lead ? 21*prep+16*point+3*idle : -18*point-3*idle;
                    hand = lead ? 16*prep-14*point : 8*point;
                    forward = 15*prep+(lead ? 30 : 16)*point;
                    tips = lead ? 8*prep-6*point : 4*point;
                } else if (beamGesture) {
                    angle = lead ? -16*draw-64*hold : 19*draw+17*hold;
                    bend = lead ? 44*draw+12*hold : -28*draw-40*hold;
                    forward = lead ? 24*draw+35*hold : 16*draw+22*hold;
                    hand = lead ? 16*draw-14*hold : 9*hold;
                    tips = lead ? 9*draw-7*hold : -5*draw;
                } else if (danceFinale) {
                    angle = (lead ? -9*draw-47*hold : 12*draw+13*hold) + (lead ? -2.5f*rightSwing : 2*leftSwing);
                    bend = lead ? 43*draw+24*hold+3*idle : -40*draw-45*hold-3*idle;
                    hand = lead ? 13*draw-18*hold : -11*draw+18*hold;
                    forward = 27*draw+(lead ? 39 : 28)*hold;
                    tips = lead ? 10*draw-6*hold : -9*draw+5*hold;
                } else if (lead) {
                    angle -= 20*open;
                    bend -= 8*open;
                } else {
                    angle += 11*open;
                    bend += 10*open;
                    hand += 8*open;
                }
                angle += (lead ? -8 : 10)*hitAmount;
                bend += (lead ? 30 : -35)*hitAmount;
                forward += 11*idle + 10*hitAmount;
                float handPhase = lead ? stance - .78f : stance - 1.38f;
                bend += (lead ? 3.1f : -2.3f) * idle * Mathf.Sin(handPhase);
                float wristIdle = (idle+breathingThroughCast) * (2.5f*Mathf.Sin(handPhase-.38f) + 1.4f*trailing);
                float fingerIdle = 1.9f * idle * Mathf.Sin(handPhase-.72f);
                part.arm.PoseDance(bend,forward,hand+wristIdle,tips+fingerIdle);
            } else if(part.arm!=null) {
                float active=motion==null?0:part.group=="arm_r"?1:-.17f;
                float bend=(casting?elbowCast:elbowAttack).Evaluate(phase)*active*fold;
                float flex=(casting?wristCast:wristAttack).Evaluate(phase)*active;
                if(part.group=="arm_l") {
                    angle+=wardLift*27;
                    bend+=wardLift*38+assistingElbow*idle+5.8f*leftSwing;
                    flex-=wardLift*11+4.3f*trailing*idle;
                } else {
                    bend-=restingElbow*idle+7.4f*rightSwing;
                    flex+=(3.8f+4.7f*Mathf.Sin(stance-.9f))*idle;
                }
                part.arm.Pose(bend,flex);
            }
            part.pivot.localRotation=Quaternion.Euler(0,0,angle);
            part.pivot.localPosition=part.rest+Vector3.up*(height*lift);
            part.pivot.localScale=new Vector3(1,stretch,1);
        }
    }
}
