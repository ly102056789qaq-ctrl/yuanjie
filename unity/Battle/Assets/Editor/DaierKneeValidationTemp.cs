using System.IO;
using System.Linq;
using System.Reflection;
using UnityEditor.SceneManagement;
using UnityEngine;

public static class DaierKneeValidationTemp
{
    public static void Capture() {
        EditorSceneManager.NewScene(NewSceneSetup.EmptyScene);
        var actor=new GameObject("Daier").AddComponent<LayerPerformer>();
        actor.Assemble("daier", 15.24f, 0);
        var cam=new GameObject("Pose camera").AddComponent<Camera>();
        cam.orthographic=true;
        cam.orthographicSize=8.25f;
        cam.transform.position=new Vector3(-.85f,7.7f,-20);
        cam.clearFlags=CameraClearFlags.SolidColor;
        cam.backgroundColor=new Color(.25f,.30f,.38f);
        var rt=new RenderTexture(888,1000,24,RenderTextureFormat.ARGB32);
        cam.targetTexture=rt;
        var src=actor.GetComponentsInChildren<SkinnedMeshRenderer>();
        if(src.Count(r=>r.bones.Any(b=>b.name=="Knuckles"))!=2) throw new System.Exception("Finger bones missing");
        var posed=new Mesh[src.Length];
        var draw=new MeshRenderer[src.Length];
        for(int n=0;n<src.Length;n++) {
            var node=new GameObject("Baked pose");
            node.transform.SetParent(src[n].transform,false);
            posed[n]=new Mesh();
            node.AddComponent<MeshFilter>().sharedMesh=posed[n];
            draw[n]=node.AddComponent<MeshRenderer>();
            draw[n].sharedMaterial=src[n].sharedMaterial;
            draw[n].sortingOrder=src[n].sortingOrder;
            var props=new MaterialPropertyBlock();
            src[n].GetPropertyBlock(props);
            draw[n].SetPropertyBlock(props);
        }
        var tex=new Texture2D(rt.width,rt.height,TextureFormat.RGB24,false);
        var flags=BindingFlags.Instance|BindingFlags.NonPublic;
        var start=typeof(LayerPerformer).GetField("start",flags);
        var offset=typeof(LayerPerformer).GetField("offset",flags);
        var update=typeof(LayerPerformer).GetMethod("PoseAt",flags);
        string folder=System.Environment.GetEnvironmentVariable("DAIER_CAPTURE_DIR");
        if(src.Count(r=>r.name=="hair_front" || r.name=="hair_back")!=2) throw new System.Exception("Missing hair meshes");
        float[,] maxTip=new float[src.Length,3];
        int minFrame=0; Vector3 minLocation=Vector3.zero;
        float maxRoot=0, slip=0, minArea=1, maxTravel=0;
        var gown=src.Single(r=>r.name=="Dance gown and legs");
        var restPositions=gown.sharedMesh.vertices;
        var triangles=gown.sharedMesh.triangles;
        if(src.Any(r=>r.name.Contains("planted legs"))) throw new System.Exception("Duplicate legs");
        float Area(Vector3[] v,int i,int j,int k) => Vector3.Cross(v[j]-v[i],v[k]-v[i]).z;
        offset.SetValue(actor,0f);
        {
            for(int f=0;f<312;f++) {
                float t=f/30f;
                if(f==89 || f==165 || f==215) {
                    actor.Act(f==89 ? "cast" : f==165 ? "attack" : "ultimate");
                    start.SetValue(actor,t);
                }
                if(f==283) { actor.Recoil(1); typeof(LayerPerformer).GetField("hitStart",flags).SetValue(actor,t); }
                update.Invoke(actor,new object[] {t,1f/30f});
                for(int n=0;n<src.Length;n++) {
                    src[n].enabled=true;
                    src[n].BakeMesh(posed[n]);
                    if(src[n]==gown) {
                        var current=posed[n].vertices;
                        for(int i=0;i<current.Length;i++) {
                            float drift=(restPositions[i]-current[i]).magnitude;
                            if(restPositions[i].y<2.1f) slip=Mathf.Max(slip,drift);
                            if(restPositions[i].y>4.4f && restPositions[i].y<5.4f)
                                maxTravel=Mathf.Max(maxTravel,drift);
                        }
                        for(int i=0;i<triangles.Length;i+=3) {
                            int a=triangles[i], b=triangles[i+1], c=triangles[i+2];
                            float ratio=Area(current,a,b,c)/Area(restPositions,a,b,c);
                            if(float.IsNaN(ratio)) throw new System.Exception("Invalid gown mesh");
                            if(ratio<minArea) {minArea=ratio; minLocation=restPositions[a];minFrame=f;}
                        }
                    }
                    if(src[n].name=="hair_front" || src[n].name=="hair_back") {
                        var rest=src[n].sharedMesh;
                        var verts=posed[n].vertices;
                        var baseVerts=rest.vertices;
                        var uv=rest.uv;
                        for(int i=0;i<verts.Length;i++) {
                            float d=(verts[i]-baseVerts[i]).magnitude*100;
                            if(float.IsNaN(d)) throw new System.Exception("Invalid deformation");
                            if(uv[i].y>.76f) maxRoot=Mathf.Max(maxRoot,d);
                            if(uv[i].y<.15f) {
                                int state=f<89 ? 0 : f<165 ? 1 : 2;
                                maxTip[n,state]=Mathf.Max(maxTip[n,state],d);
                            }
                        }
                    }
                    src[n].enabled=false;
                }
                cam.Render();
                RenderTexture.active=rt;
                tex.ReadPixels(new Rect(0,0,rt.width,rt.height),0,0);
                tex.Apply();
                File.WriteAllBytes(Path.Combine(folder,"pose"+f.ToString("D3")+".jpg"),tex.EncodeToJPG(97));
            }
        }
        for(int n=0;n<src.Length;n++) {
            if(src[n].name!="hair_front" && src[n].name!="hair_back") continue;
            Debug.Log("HAIR_CHECK "+src[n].name+" root="+maxRoot+" tips="+maxTip[n,0]+","+maxTip[n,1]+","+maxTip[n,2]);
            if(maxRoot>.04f || maxTip[n,0]<.6f || maxTip[n,1]<1 || maxTip[n,2]<1) throw new System.Exception("Hair motion outside limits");
        }
        Debug.Log($"DAIER_KNEES pin={slip} minArea={minArea} kneeBandTravel={maxTravel} minFrame={minFrame} minLocation={minLocation}");
        if(slip>.001f || minArea<.52f || maxTravel<.01f) throw new System.Exception("Lower-body regression");
        BattleBuild.Web();
    }
}
