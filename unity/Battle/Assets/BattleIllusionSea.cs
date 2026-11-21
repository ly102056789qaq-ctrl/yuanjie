using UnityEngine;
using DamageNumbersPro;

public sealed class BattleIllusionSea : MonoBehaviour
{
    private static readonly int SeaLevel = Shader.PropertyToID("_YJSeaLevel");
    private static readonly int SeaLines = Shader.PropertyToID("_YJSeaLines");
    private static readonly int SeaTime = Shader.PropertyToID("_YJSeaTime");
    private SpriteRenderer horizon;
    private Color originalColor;
    private GameObject field;
    private float strength, elapsed;
    private bool requested;
    private Camera battleCamera;
    private DamageNumber standard, emphasis;

    public void Initialize(SpriteRenderer backdrop, Camera view)
    {
        horizon = backdrop;
        originalColor = backdrop.color;
        battleCamera = view;
        Shader.SetGlobalTexture(SeaLines, Resources.Load<Texture2D>("PurchasedBattle/Plexus_Lines"));
        Shader.SetGlobalFloat(SeaLevel, 0);
        standard = Resources.Load<DamageNumber>("PurchasedBattle/Spread Up");
        emphasis = Resources.Load<DamageNumber>("PurchasedBattle/Overwrite"); // Gold from Damage Numbers Pro
    }

    public void SetField(bool active)
    {
        if (active == requested) return;
        requested = active;
        if (!active) return;
        elapsed = 0;
        if (field) Destroy(field);
        field = new GameObject("Illusion Sea");
        field.transform.SetParent(transform, false);
        AddParticles("ShintoParticles", new Vector3(0, .10f, 1.5f), .78f, false);
        AddParticles("Plexus", new Vector3(-2.9f, .24f, 1.8f), .83f, true);
        AddParticles("Plexus", new Vector3(2.3f, .30f, 2.0f), .72f, true);
    }

    private void AddParticles(string asset, Vector3 position, float scale, bool loop)
    {
        var prefab = Resources.Load<GameObject>("PurchasedBattle/" + asset);
        if (!prefab) return;
        var effect = Instantiate(prefab, position, Quaternion.identity, field.transform);
        effect.transform.localScale = Vector3.one * scale;
        foreach (var particles in effect.GetComponentsInChildren<ParticleSystem>(true)) {
            var main = particles.main;
            main.loop = loop;
            main.maxParticles = Mathf.Min(main.maxParticles, 60);
            main.scalingMode = ParticleSystemScalingMode.Hierarchy;
            particles.Play();
        }
    }

    public void Number(string kind, Vector3 position, int value, float speed, string tint)
    {
        bool strong = kind == "emphasis";
        var template = strong ? emphasis : standard;
        if (!template) return;
        var popup = template.Spawn(position, value);
        if (!strong) {
            popup.SetColor(Color.white);
            popup.SetGradientColor(new TMPro.VertexGradient(Color.white, Color.white,
                new Color(.76f,.88f,.98f), new Color(.76f,.88f,.98f)));
        }
        popup.enableNumber = true;
        popup.enableLeftText = false;
        popup.enableRightText = false;
        popup.cameraOverride = battleCamera.transform;
        popup.fovCamera = battleCamera;
        popup.enable3DGame = true;
        popup.faceCameraView = true;
        popup.renderThroughWalls = true;
        popup.lifetime = (strong ? 1.18f : .94f) / Mathf.Sqrt(Mathf.Max(1, speed));
        popup.SetScale(strong ? .64f : .46f);
        popup.transform.SetParent(transform, true);
    }

    private void Update()
    {
        if (!requested && strength <= 0) return;
        elapsed += Time.deltaTime;
        strength = Mathf.MoveTowards(strength, requested ? 1f : 0f, Time.deltaTime * (requested ? 1.25f : .95f));
        Shader.SetGlobalFloat(SeaTime, elapsed);
        Shader.SetGlobalFloat(SeaLevel, strength);
        horizon.color = Color.Lerp(originalColor, new Color(.55f, .50f, .86f, originalColor.a), strength);
        if (!requested && strength <= 0 && field) Destroy(field);
    }

    public void Clear()
    {
        requested = false;
        strength = 0;
        Shader.SetGlobalFloat(SeaLevel, 0);
        if (horizon) horizon.color = originalColor;
        foreach (Transform item in transform) Destroy(item.gameObject);
    }

    private void OnDestroy() { Shader.SetGlobalFloat(SeaLevel, 0); }
}
