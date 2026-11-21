using UnityEngine;

public sealed class BeastBolt : MonoBehaviour
{
    private LineRenderer core, halo;
    private Vector3 origin, target, direction;
    private float age, flight, speed;
    private bool arced;

    public void Setup(Material material, bool whale)
    {
        arced = whale;
        var tint = whale ? new Color(.23f,.90f,1) : new Color(1,.39f,.12f);
        halo = Stroke(material, tint, .11f, 15);
        core = Stroke(material, Color.Lerp(tint, Color.white,.76f), .037f, 16);
        gameObject.SetActive(false);
    }

    private LineRenderer Stroke(Material material, Color color, float width, int order)
    {
        var stroke = new GameObject("Stroke").AddComponent<LineRenderer>();
        stroke.transform.SetParent(transform,false);
        stroke.sharedMaterial = material;
        var properties = new MaterialPropertyBlock();
        properties.SetTexture("_MainTex", Texture2D.whiteTexture);
        stroke.SetPropertyBlock(properties);
        stroke.startColor = color;
        stroke.endColor = color;
        stroke.startWidth = width*.18f;
        stroke.endWidth = width;
        stroke.positionCount = 3;
        stroke.sortingOrder = order;
        stroke.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
        stroke.receiveShadows = false;
        return stroke;
    }

    public void Fire(Vector3 from, Vector3 to, float duration, float rate)
    {
        origin = from;
        target = to;
        direction = (to-from).normalized;
        age = 0;
        flight = Mathf.Max(.1f,duration);
        speed = Mathf.Max(.1f,rate);
        gameObject.SetActive(true);
        Draw();
    }

    private Vector3 Point(float phase)
    {
        phase = Mathf.Clamp01(phase);
        return Vector3.Lerp(origin,target,phase) + Vector3.up*((arced?.42f:.06f)*Mathf.Sin(phase*Mathf.PI));
    }

    private void LateUpdate()
    {
        age += Time.deltaTime*speed;
        if (age > flight+.13f) gameObject.SetActive(false);
        else Draw();
    }

    private void Draw()
    {
        float phase = age/flight;
        Vector3 head = Point(phase), middle = Point(phase-.09f), tail = Point(phase-.18f);
        if (age>=flight) {
            float fade = Mathf.Clamp01(1-(age-flight)/.13f);
            head=target+direction*.22f*fade;
            middle=target;
            tail=target-direction*.35f*fade;
        }
        core.SetPosition(0,tail); core.SetPosition(1,middle); core.SetPosition(2,head);
        halo.SetPosition(0,tail); halo.SetPosition(1,middle); halo.SetPosition(2,head);
    }
}
