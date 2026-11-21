using UnityEngine;

public sealed class IonDischarge : MonoBehaviour
{
    private readonly LineRenderer[] strokes=new LineRenderer[3];
    private Transform wrist;
    private Vector3 contact;
    private float rate, birth;
    private static readonly Color[] Colors={new Color(.35f,.64f,1f),new Color(.87f,.90f,1f),new Color(.58f,.48f,1f)};
    private static readonly float[] Widths={.084f,.025f,.018f};
    private const int Points=25;

    public static void Play(Transform hand,Vector3 target,Material atlasMaterial,float speed)
    {
        if(!hand) return;
        var arc=new GameObject("Ion discharge").AddComponent<IonDischarge>();
        arc.wrist=hand; arc.contact=target; arc.rate=Mathf.Clamp(speed,.25f,4); arc.birth=Time.time;
        var white=new MaterialPropertyBlock(); white.SetTexture("_MainTex",Texture2D.whiteTexture);
        for(int index=0;index<arc.strokes.Length;index++) {
            var line=new GameObject("Filament").AddComponent<LineRenderer>();
            line.transform.SetParent(arc.transform,false);
            line.sharedMaterial=atlasMaterial; line.SetPropertyBlock(white);
            line.useWorldSpace=true; line.numCornerVertices=1; line.sortingOrder=22+index; line.positionCount=Points;
            line.widthCurve=AnimationCurve.EaseInOut(0,1,1,.25f);
            arc.strokes[index]=line;
        }
        arc.LateUpdate();
    }

    private void LateUpdate()
    {
        float age=(Time.time-birth)*rate;
        if(age>=.34f || !wrist) {Destroy(gameObject);return;}
        float reach=Mathf.Min(1,.08f+age*15);
        float glow=1-Mathf.SmoothStep(0,1,Mathf.Clamp01((age-.10f)/.24f));
        float seed=Mathf.Floor(age*19)*3.71f;
        var origin=wrist.position+Vector3.back*.13f;
        for(int index=0;index<strokes.Length;index++) {
            var stroke=strokes[index];
            stroke.widthMultiplier=Widths[index]*glow;
            var color=Colors[index]*glow; color.a=index==0?.40f:1;
            stroke.startColor=color; stroke.endColor=color;
            for(int point=0;point<Points;point++) {
                float fraction=(float)point/(Points-1);
                float distance=(index==2?Mathf.Lerp(.41f,.80f,fraction):fraction)*reach;
                float envelope=Mathf.Sin(Mathf.PI*distance);
                float jitter=Mathf.PerlinNoise(distance*27+seed,3.7f)-.5f;
                float lift=envelope*(.17f+jitter*.61f);
                if(index==2) lift+=.24f*Mathf.Sin(fraction*Mathf.PI);
                stroke.SetPosition(point,Vector3.Lerp(origin,contact,distance)+Vector3.up*lift);
            }
        }
    }
}
