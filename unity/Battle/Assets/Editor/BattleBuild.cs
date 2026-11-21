using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEditor.Build.Reporting;
using UnityEngine;
using UnityEngine.Playables;
using UnityEngine.Timeline;

public static class BattleBuild
{
    public static void Web()
    {
        const string manaFolder = "Assets/LocalDebut/mana";
        if (AssetDatabase.IsValidFolder(manaFolder)) {
            foreach (var guid in AssetDatabase.FindAssets("t:Material", new[] {manaFolder})) {
                var material = AssetDatabase.LoadAssetAtPath<Material>(AssetDatabase.GUIDToAssetPath(guid));
                if (!material || !material.HasProperty("_BUILTIN_Surface")) continue;
                UnityEditor.Rendering.BuiltIn.ShaderGraph.BuiltInBaseShaderGUI.SetupSurface(material);
                EditorUtility.SetDirty(material);
            }
            AssetDatabase.SaveAssets();
        }
        const string scenePath = "Assets/Battle.unity";
        var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene);
        var stage = new GameObject("BattleStage").AddComponent<BattleStage>();
        var director = stage.gameObject.AddComponent<PlayableDirector>();
        const string path = "Assets/RinUltimate.playable";
        var timeline = AssetDatabase.LoadAssetAtPath<TimelineAsset>(path);
        if (!timeline) {
            timeline = ScriptableObject.CreateInstance<TimelineAsset>();
            AssetDatabase.CreateAsset(timeline,path);
            var track = timeline.CreateTrack<RinShotTrack>(null,"等雨停的时候");
            double[] beats = {0,.65,2.75,3.95,4.95,5.75};
            string[] labels = {"抬手 / 推近", "雨夜花店", "指尖与花瓣", "全队治疗", "返回战场"};
            for(int index=0; index<labels.Length; index++) {
                var clip=track.CreateClip<RinShot>();
                clip.displayName=labels[index]; clip.start=beats[index]; clip.duration=beats[index+1]-beats[index];
                ((RinShot)clip.asset).shot=index;
                EditorUtility.SetDirty(clip.asset);
            }
            EditorUtility.SetDirty(track); EditorUtility.SetDirty(timeline);
            AssetDatabase.SaveAssets();
        }
        director.playableAsset=timeline;
        director.playOnAwake=false;
        director.extrapolationMode=DirectorWrapMode.None;
        foreach (var track in timeline.GetOutputTracks()) director.SetGenericBinding(track,stage);
        EditorSceneManager.SaveScene(scene, scenePath);
        EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(scenePath, true) };
        PlayerSettings.WebGL.compressionFormat = WebGLCompressionFormat.Disabled;
        PlayerSettings.WebGL.initialMemorySize = 256;
        PlayerSettings.WebGL.debugSymbolMode = WebGLDebugSymbolMode.External;
        PlayerSettings.colorSpace = ColorSpace.Gamma;
        var folder = Path.GetFullPath("../../battle3d/unity/player");
        var result = BuildPipeline.BuildPlayer(new[] { scenePath }, folder, BuildTarget.WebGL, BuildOptions.None);
        if (result.summary.result != BuildResult.Succeeded) throw new System.Exception(result.summary.result.ToString());
        File.WriteAllText(Path.Combine(folder, "build-id.txt"), result.summary.guid.ToString());
    }
}
