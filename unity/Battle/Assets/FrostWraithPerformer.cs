using System.Collections.Generic;
using UnityEngine;

public class FrostWraithPerformer : MonoBehaviour
{
    private readonly List<Transform> veils = new List<Transform>();
    private readonly List<Quaternion> rest = new List<Quaternion>();
    private Vector3 center;
    private Quaternion facing;
    private float impulse, tempo;
    private bool recoil;

    public static FrostWraithPerformer Assemble(Transform parent, float height)
    {
        var model = Instantiate(Resources.Load<GameObject>("Stage/FrostWraith"), parent).transform;
        var motion = model.gameObject.AddComponent<FrostWraithPerformer>();
        var parts = model.GetComponentsInChildren<Renderer>();
        Transform face = null, back = null;
        foreach (var piece in model.GetComponentsInChildren<Transform>()) {
            if (piece.name == "FaceAxis") face = piece;
            if (piece.name == "BackAxis") back = piece;
            if (piece.name.StartsWith("Veil_")) { motion.veils.Add(piece); motion.rest.Add(piece.localRotation); }
        }
        if (face && back) {
            var front = Vector3.ProjectOnPlane(face.position - back.position,Vector3.up);
            model.Rotate(Vector3.up,Vector3.SignedAngle(front,new Vector3(.48f,0,-1),Vector3.up),Space.World);
        }
        var bounds = BoundsOf(parts);
        model.localScale *= height / bounds.size.y;
        bounds = BoundsOf(parts);
        model.position += parent.position - new Vector3(bounds.center.x,bounds.min.y-.10f,bounds.center.z);
        var silk = Surface("WraithVeil", Color.white);
        var dark = Surface("WraithVeil", new Color(.55f,.65f,.82f));
        var porcelain = Surface("WraithMask", Color.white);
        foreach (var part in parts) {
            if (part.name == "PorcelainMask") part.sharedMaterial = porcelain;
            else if (part.name == "MidnightCowl" || part.name.StartsWith("Veil_0")) part.sharedMaterial = dark;
            else if (part.name.StartsWith("Veil_")) part.sharedMaterial = silk;
        }
        motion.center = model.localPosition;
        motion.facing = model.localRotation;
        return motion;
    }

    private static Material Surface(string texture, Color tint)
    {
        return new Material(Resources.Load<Shader>("WraithSilk")) { mainTexture = Resources.Load<Texture2D>("Stage/" + texture), color = tint };
    }

    private static Bounds BoundsOf(Renderer[] parts)
    {
        var bounds = parts[0].bounds;
        foreach (var part in parts) bounds.Encapsulate(part.bounds);
        return bounds;
    }

    public void React(bool hit, float speed)
    {
        recoil = hit;
        impulse = 1;
        tempo = Mathf.Max(1,speed);
    }

    private void Update()
    {
        float clock = Time.time;
        impulse = Mathf.MoveTowards(impulse,0,Time.deltaTime * tempo * 1.7f);
        float sweep = Mathf.Sin(Mathf.PI * impulse) * (recoil ? -1 : 1);
        transform.localPosition = center + Vector3.up * (.06f * Mathf.Sin(clock * 1.9f) + .08f * sweep) + Vector3.right * (.12f * sweep);
        transform.localRotation = Quaternion.Euler(2 * Mathf.Sin(clock),4 * Mathf.Sin(clock * .73f) + 8 * sweep,4 * sweep) * facing;
        for (int index = 0; index < veils.Count; index++) {
            float wave = clock * 1.95f + index * 2.4f;
            veils[index].localRotation = Quaternion.Euler(2.6f*Mathf.Sin(wave)+5*sweep,0,3.6f*Mathf.Cos(wave)+3*sweep) * rest[index];
        }
    }
}
