using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class BattleMobaEffects : MonoBehaviour
{
    // A staged clone has never played. Its scripts, sub-emitters and trails start
    // exactly once, including prefabs with their own destruction callbacks.
    private readonly Dictionary<string, GameObject> sources = new();
    private readonly Dictionary<string, GameObject> staged = new();
    private Transform staging;
    private Camera warmCamera;
    private RenderTexture warmTarget;
    private readonly HashSet<Material> warmedMaterials = new();

    public void Prepare(string asset)
    {
        if (staged.ContainsKey(asset)) return;
        if (!staging) {
            staging = new GameObject("Prepared spells").transform;
            staging.SetParent(transform, false);
            staging.gameObject.SetActive(false);
        }
        var source = LoadSource(asset);
        if (!source) return;
        var clone = Instantiate(source, staging, false);
        staged[asset] = clone;
        WarmRenderers(clone);
    }

    private void WarmRenderers(GameObject clone)
    {
        // Render one representative particle with the original mesh, material
        // and vertex streams. Never activate the staged gameplay prefab here.
        if (!warmCamera) {
            warmTarget = new RenderTexture(32,32,24);
            warmCamera = new GameObject("Particle warmup camera").AddComponent<Camera>();
            warmCamera.transform.SetParent(transform,false);
            warmCamera.enabled = false;
            warmCamera.cullingMask = 1 << 30;
            warmCamera.clearFlags = CameraClearFlags.SolidColor;
            warmCamera.orthographic = true;
            warmCamera.orthographicSize = 1;
            warmCamera.transform.position = new Vector3(0,-100,0);
            warmCamera.depthTextureMode = DepthTextureMode.Depth;
            warmCamera.targetTexture = warmTarget;
        }
        var samples = new List<GameObject>();
        foreach (var renderer in clone.GetComponentsInChildren<ParticleSystemRenderer>(true)) {
            var material = renderer.sharedMaterial;
            if (!renderer.enabled || !material || !warmedMaterials.Add(material)) continue;
            var sample = new GameObject("Particle sample");
            sample.layer = 30;
            sample.transform.position = warmCamera.transform.position + Vector3.forward * 4;
            var ps = sample.AddComponent<ParticleSystem>();
            ps.Stop(true, ParticleSystemStopBehavior.StopEmittingAndClear);
            var emission = ps.emission; emission.enabled = false;
            var shape = ps.shape; shape.enabled = false;
            var main = ps.main; main.startSize = .5f; main.startSpeed = 0;
            var proxy = sample.GetComponent<ParticleSystemRenderer>();
            proxy.renderMode = renderer.renderMode;
            if (renderer.renderMode == ParticleSystemRenderMode.Mesh) proxy.mesh = renderer.mesh;
            proxy.sharedMaterial = material;
            var streams = new List<ParticleSystemVertexStream>();
            renderer.GetActiveVertexStreams(streams);
            proxy.SetActiveVertexStreams(streams);
            ps.Emit(1);
            samples.Add(sample);
        }
        if (samples.Count > 0) warmCamera.Render();
        foreach (var sample in samples) { sample.SetActive(false); Destroy(sample); }
    }

    public void FinishPreparation()
    {
        if (!warmCamera) return;
        warmCamera.targetTexture = null;
        Destroy(warmCamera.gameObject);
        warmTarget.Release();
        Destroy(warmTarget);
        warmedMaterials.Clear();
    }

    private GameObject LoadSource(string asset)
    {
        if (!sources.TryGetValue(asset, out var source)) {
            source = Resources.Load<GameObject>("BattleMoba/" + asset);
            if (source) sources.Add(asset, source);
            else Debug.LogError("Missing battle effect: " + asset);
        }
        return source;
    }

    public void Lightning(Vector3 ground, float speed)
    {
        Spawn("Lightning", ground + new Vector3(0,.08f,-.38f), Quaternion.identity, .74f, speed, 2.2f);
    }

    public void Launch(string element, Vector3 origin, Vector3 contact, Vector3 ground, float duration, float speed)
    {
        StartCoroutine(Fly(element, origin, contact, ground, duration, Mathf.Max(.1f,speed)));
    }

    public GameObject Spell(string asset, Vector3 position, float scale, float lifetime, float speed, Quaternion rotation)
    {
        return Spawn(asset, position, rotation, scale, speed, lifetime);
    }

    public void Vine(Vector3 ground, float speed)
    {
        Spawn("Vine spell", ground + Vector3.up * .04f, Quaternion.identity, .65f, speed, 4.2f);
        Spawn("Vine cage", ground + Vector3.up * .06f, Quaternion.identity, .54f, speed, 4.2f);
    }

    private IEnumerator Fly(string element, Vector3 origin, Vector3 target, Vector3 ground, float duration, float speed)
    {
        var direction = Quaternion.LookRotation(target - origin);
        bool mana = element == "mana";
        if (!mana) Spawn("Flash " + element, origin, direction, .67f, speed, 1.4f);
        var bolt = Spawn(mana ? "2) Projectile" : "Projectile " + element, origin, direction, mana ? .72f : .78f, speed, 0);
        if (!bolt) yield break;
        for (float elapsed = 0; elapsed < duration; elapsed += Time.deltaTime * speed) {
            if (!bolt) yield break;
            float fraction = elapsed / duration;
            bolt.transform.position = Vector3.Lerp(origin,target,fraction) + Vector3.up * (.20f * Mathf.Sin(Mathf.PI * fraction));
            yield return null;
        }
        Destroy(bolt);
        Spawn(mana ? "2) Projectile Hit" : "Hit " + element, target, Quaternion.LookRotation(origin - target), .75f, speed, 1.6f);
        if (element == "ice") Spawn("Ice eruption", ground + Vector3.up * .05f, Quaternion.identity, .70f, speed, 3f);
    }

    private GameObject Spawn(string asset, Vector3 position, Quaternion rotation, float scale, float speed, float lifetime)
    {
        var source = LoadSource(asset);
        if (!source) return null;
        GameObject effect;
        bool prepared = staged.Remove(asset, out effect) && effect;
        if (prepared) {
            effect.SetActive(false);
            effect.transform.SetParent(transform, false);
            effect.transform.SetPositionAndRotation(position, rotation);
        } else effect = Instantiate(source, position, rotation, transform);
        effect.transform.localScale *= scale;
        if (asset.StartsWith("Projectile ") || asset == "2) Projectile") {
            foreach (var behaviour in effect.GetComponentsInChildren<MonoBehaviour>(true))
                if (behaviour) behaviour.enabled = false;
            foreach (var collider in effect.GetComponentsInChildren<Collider>(true)) collider.enabled = false;
            foreach (var body in effect.GetComponentsInChildren<Rigidbody>(true)) body.isKinematic = true;
            foreach (var part in effect.GetComponentsInChildren<Transform>(true))
                if (part.name.StartsWith("Flash ") || part.name.StartsWith("Hit ")) part.gameObject.SetActive(false);
        }
        foreach (var behaviour in effect.GetComponentsInChildren<MonoBehaviour>(true)) {
            if (!behaviour) continue;
            var componentName = behaviour.GetType().Name;
            if (componentName == "HS_EffectOnDie" || componentName == "HS_ParticleCollisionInstance" || componentName == "ParticleCollisionInstance") behaviour.enabled = false;
        }
        foreach (var particles in effect.GetComponentsInChildren<ParticleSystem>(true)) {
            var settings = particles.main;
            if (asset == "Dark magic rain") {
                var collision = particles.collision;
                collision.sendCollisionMessages = false;
            }
            settings.scalingMode = ParticleSystemScalingMode.Hierarchy;
            settings.simulationSpeed *= Mathf.Max(.1f, speed);
            if (lifetime > 0) settings.loop = false;
        }
        if (prepared) effect.SetActive(true);
        if (lifetime > 0) Destroy(effect,lifetime / Mathf.Max(.1f,speed));
        return effect;
    }

    public void Clear()
    {
        StopAllCoroutines();
        foreach (Transform effect in transform) if (effect != staging) Destroy(effect.gameObject);
    }
}
