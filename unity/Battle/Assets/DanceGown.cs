using UnityEngine;

internal sealed class DanceGown
{
    private readonly Transform left, right;
    private readonly WeightedArt mesh;

    public DanceGown(Transform root, Transform pelvis, Texture2D texture, Vector3 origin,
        float pixels, float height, int order)
    {
        Transform Hem(string name, float side)
        {
            var bone = new GameObject(name).transform;
            bone.SetParent(pelvis, false);
            bone.localPosition = new Vector3(.085f * side, -.045f, 0) * height;
            return bone;
        }
        left = Hem("Hem L", -1);
        right = Hem("Hem R", 1);
        Vector2 extent = new Vector2(texture.width, texture.height) / pixels;
        BoneWeight Weights(Vector2 uv)
        {
            Vector2 point = (Vector2)origin + Vector2.Scale(uv, extent);
            float side = (point.x - pelvis.localPosition.x) / height;
            float elevation = point.y / height;
            float waist = Fade(.16f, .53f, elevation);
            // One continuous surface through both knees. Only the fabric outside
            // the calves can pick up hem motion, and both shoes are pinned.
            float fabric = Fade(.093f, .203f, Mathf.Abs(side)) * Fade(.15f, .28f, elevation);
            float hemWeight = (1 - waist) * fabric;
            var weights = WeightedArt.Blend(0, 1, waist / Mathf.Max(1e-6f, 1 - hemWeight));
            weights.weight0 *= 1 - hemWeight;
            weights.weight1 *= 1 - hemWeight;
            int hem = side < 0 ? 2 : 3;
            if (hemWeight >= weights.weight0) {
                weights.boneIndex2 = weights.boneIndex1; weights.weight2 = weights.weight1;
                weights.boneIndex1 = weights.boneIndex0; weights.weight1 = weights.weight0;
                weights.boneIndex0 = hem; weights.weight0 = hemWeight;
            } else if (hemWeight > weights.weight1) {
                weights.boneIndex2 = weights.boneIndex1; weights.weight2 = weights.weight1;
                weights.boneIndex1 = hem; weights.weight1 = hemWeight;
            } else {
                weights.boneIndex2 = hem; weights.weight2 = hemWeight;
            }
            return weights;
        }
        mesh = new WeightedArt("Dance gown and legs", root, texture, origin, pixels, order,
            new[] { root, pelvis, left, right }, Weights, 36, 48, SkinQuality.Bone4);
    }

    private static float Fade(float low, float high, float value) =>
        Mathf.SmoothStep(0, 1, Mathf.InverseLerp(low, high, value));

    public void Pose(float clock, float stance, float idle, float follow, float settle)
    {
        float sweep = 2.7f * follow + 4.1f * settle;
        left.localRotation = Quaternion.Euler(0, 0, sweep + idle *
            (1.55f * Mathf.Sin(stance - .65f) + .68f * Mathf.Sin(clock - 1.1f)));
        right.localRotation = Quaternion.Euler(0, 0, .82f * sweep + idle *
            (1.35f * Mathf.Sin(stance - 1.15f) - .84f * Mathf.Sin(clock - .60f)));
    }

    public void Tint(Color color) => mesh.Tint(color);
}
