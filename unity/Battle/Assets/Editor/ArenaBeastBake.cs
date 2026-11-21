using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEngine;
using Object = UnityEngine.Object;

public sealed class ArenaBeastImport : AssetPostprocessor
{
    private void OnPreprocessModel()
    {
        if (!assetPath.StartsWith("Assets/BattleBeasts/")) return;
        var importer = (ModelImporter)assetImporter;
        importer.animationType = ModelImporterAnimationType.Legacy;
        importer.importAnimation = !assetPath.EndsWith("/Model.fbx");
        importer.preserveHierarchy = true;
        importer.importCameras = false;
        importer.importLights = false;
        importer.importBlendShapes = false;
    }
}

public static class ArenaBeastBake
{
    public static void Web()
    {
        Bake("06", "e0", 2.36f, 2.9f, 0, new Color(1,.64f,.33f), "head", "pelvis");
        Bake("02", "e1", 1.58f, 2.35f, .63f, new Color(.42f,.83f,1), "Head_joint1", "Tail_joint4");
        Bake("04", "e2", 1.18f, 3.05f, 1.82f, new Color(.45f,1,.87f), "Head", "Tail3");
        AssetDatabase.SaveAssets();
        AssetDatabase.Refresh();
        BattleBuild.Web();
    }

    private static void Bake(string number, string id, float height, float width, float hover, Color accent, string snout, string rear)
    {
        string folder = "Assets/BattleBeasts/Beast" + number;
        var wrapper = new GameObject("Beast" + number);
        try {
            var source = AssetDatabase.LoadAssetAtPath<GameObject>(folder + "/Model.fbx");
            var model = Object.Instantiate(source, wrapper.transform);
            model.name = "Model";
            var performer = wrapper.AddComponent<ArenaBeast>();
            performer.rig = model.GetComponent<Animation>() ?? model.AddComponent<Animation>();
            performer.rig.playAutomatically = false;
            performer.idle = Clip(folder, "Idle", model);
            performer.attack = Clip(folder, "Attack", model);
            performer.hit = Clip(folder, "Hit", model);
            performer.death = Clip(folder, "Death", model);
            performer.idle.SampleAnimation(model, 0);
            var bones = model.GetComponentsInChildren<Transform>();
            Transform Bone(string name) => bones.First(bone => bone.name.Equals(name, StringComparison.OrdinalIgnoreCase));
            var forward = Bone(snout).position - Bone(rear).position;
            forward.y = 0;
            model.transform.rotation = Quaternion.AngleAxis(Vector3.SignedAngle(forward, new Vector3(.86f,0,-.51f), Vector3.up), Vector3.up) * model.transform.rotation;
            var bounds = BoundsOf(model);
            model.transform.localScale *= Mathf.Min(height / bounds.size.y, width / bounds.size.x);
            bounds = BoundsOf(model);
            model.transform.position += new Vector3(-bounds.center.x, hover - bounds.min.y, -bounds.center.z);
            var materials = new Dictionary<string, Material>();
            foreach (var renderer in model.GetComponentsInChildren<SkinnedMeshRenderer>()) {
                renderer.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
                renderer.receiveShadows = false;
                renderer.sharedMaterials = renderer.sharedMaterials.Select(original => {
                    string key = original.name.Split('_').Last();
                    if (materials.TryGetValue(key, out var material)) return material;
                    string path = folder + "/" + key + ".mat";
                    material = AssetDatabase.LoadAssetAtPath<Material>(path);
                    if (!material) {
                        material = new Material(Shader.Find("Yuanjie/BeastCel"));
                        AssetDatabase.CreateAsset(material, path);
                    }
                    string part = key == "Glass" ? "Armor" : key;
                    var paint = AssetDatabase.LoadAssetAtPath<Texture2D>(folder + "/" + part + "_BaseColor.png");
                    if (!paint) throw new InvalidDataException(path + " missing paint");
                    material.mainTexture = paint;
                    material.SetTexture("_GlowTex", AssetDatabase.LoadAssetAtPath<Texture2D>(folder + "/" + part + "_Emissive.png"));
                    material.SetColor("_Accent", accent);
                    EditorUtility.SetDirty(material);
                    materials.Add(key, material);
                    return material;
                }).ToArray();
            }
            if (!AssetDatabase.IsValidFolder("Assets/Resources/ArenaBeasts")) AssetDatabase.CreateFolder("Assets/Resources", "ArenaBeasts");
            PrefabUtility.SaveAsPrefabAsset(wrapper, "Assets/Resources/ArenaBeasts/Beast" + number + ".prefab");
            bounds = BoundsOf(model);
            Debug.Log($"Beast{number} fitted {bounds} nose {Bone(snout).position}");
            Portrait(id, bounds, Bone(snout).position);
        } finally { Object.DestroyImmediate(wrapper); }
    }

    private static AnimationClip Clip(string folder, string motion, GameObject model)
    {
        var source = AssetDatabase.LoadAllAssetsAtPath(folder + "/" + motion + ".fbx").OfType<AnimationClip>().First(clip => !clip.name.StartsWith("__"));
        var transforms = model.GetComponentsInChildren<Transform>();
        var paths = transforms.Select(bone => AnimationUtility.CalculateTransformPath(bone,model.transform)).ToArray();
        var bindings = AnimationUtility.GetCurveBindings(source);
        var target = new AnimationClip { legacy = true, frameRate = source.frameRate };
        int matched = 0;
        foreach (var binding in bindings) {
            if (binding.type != typeof(Transform) || binding.path.Length == 0) continue;
            string leaf = binding.path.Split('/').Last();
            var path = paths.Contains(binding.path) ? binding.path : paths.SingleOrDefault(entry => entry.EndsWith("/" + leaf) || entry == leaf);
            if (path == null) continue;
            var dest = binding;
            dest.path = path;
            AnimationUtility.SetEditorCurve(target, dest, AnimationUtility.GetEditorCurve(source,binding));
            matched++;
        }
        if (matched < 12 || target.length <= 0) throw new InvalidDataException($"{folder}/{motion} only {matched} curves");
        target.wrapMode = motion == "Idle" ? WrapMode.Loop : WrapMode.ClampForever;
        string asset = folder + "/" + motion + ".anim";
        var saved = AssetDatabase.LoadAssetAtPath<AnimationClip>(asset);
        if (!saved) AssetDatabase.CreateAsset(target, asset);
        else { EditorUtility.CopySerialized(target,saved); Object.DestroyImmediate(target); EditorUtility.SetDirty(saved); }
        Debug.Log($"{folder}/{motion} {matched} curves, {source.length:F2}s");
        return saved ? saved : target;
    }

    private static Bounds BoundsOf(GameObject model)
    {
        var bounds = new Bounds();
        bool initialized = false;
        var mesh = new Mesh();
        foreach (var renderer in model.GetComponentsInChildren<SkinnedMeshRenderer>()) {
            renderer.BakeMesh(mesh, true);
            var unscaled = Matrix4x4.TRS(renderer.transform.position,renderer.transform.rotation,Vector3.one);
            foreach (var vertex in mesh.vertices) {
                var world = unscaled.MultiplyPoint3x4(vertex);
                if (!initialized) { bounds = new Bounds(world,Vector3.zero); initialized = true; }
                else bounds.Encapsulate(world);
            }
        }
        Object.DestroyImmediate(mesh);
        if (!initialized) throw new InvalidDataException(model.name + " empty mesh");
        return bounds;
    }

    private static void Portrait(string id, Bounds bounds, Vector3 head)
    {
        var camera = new GameObject("Portrait").AddComponent<Camera>();
        var surface = RenderTexture.GetTemporary(256,256,24);
        var image = new Texture2D(256,256,TextureFormat.RGB24,false);
        var previous = RenderTexture.active;
        try {
            Vector3 focus = Vector3.Lerp(bounds.center, head, .62f);
            camera.transform.position = focus + new Vector3(2,.65f,-4);
            camera.transform.LookAt(focus);
            camera.orthographic = true;
            camera.orthographicSize = Mathf.Max(bounds.size.y*.36f, bounds.size.x*.24f, .48f);
            camera.clearFlags = CameraClearFlags.SolidColor;
            camera.backgroundColor = new Color(.19f,.25f,.32f);
            camera.targetTexture = surface;
            camera.Render(); RenderTexture.active = surface;
            image.ReadPixels(new Rect(0,0,256,256),0,0);
            image.Apply();
            var png = image.EncodeToPNG();
            File.WriteAllBytes("Assets/Resources/CommandHud/" + id + "-face.png", png);
            File.WriteAllBytes("../../assets/battle/arena-" + id + ".png", png);
        } finally {
            camera.targetTexture = null; RenderTexture.active = previous;
            RenderTexture.ReleaseTemporary(surface); Object.DestroyImmediate(image); Object.DestroyImmediate(camera.gameObject);
        }
    }
}
