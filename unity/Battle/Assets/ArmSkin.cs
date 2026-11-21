using UnityEngine;

public sealed class ArmSkin
{
    private readonly Transform elbow, wrist, knuckles;
    public Transform Wrist => wrist;
    private readonly WeightedArt skin;

    public ArmSkin(Transform shoulder, Texture2D art, Vector3 origin, float pixels, bool right, string actor, int order)
    {
        var elbowPoint = right ? new Vector2(.63f,.59f) : new Vector2(.32f,.59f);
        var wristPoint = right ? new Vector2(.27f,.23f) : new Vector2(.70f,.23f);
        if (actor == "rin") { elbowPoint = right ? new Vector2(.65f,.59f) : new Vector2(.34f,.59f); wristPoint = right ? new Vector2(.23f,.23f) : new Vector2(.73f,.23f); }
        if (actor == "siwei") { elbowPoint = right ? new Vector2(.59f,.57f) : new Vector2(.48f,.52f); wristPoint = right ? new Vector2(.20f,.19f) : new Vector2(.73f,.20f); }
        if (actor == "dekeke") { elbowPoint = right ? new Vector2(.64f,.62f) : new Vector2(.36f,.60f); wristPoint = right ? new Vector2(.20f,.23f) : new Vector2(.79f,.22f); }
        if (actor == "daier") {
            elbowPoint = right ? new Vector2(.600f, .600f) : new Vector2(.453f, .600f);
            wristPoint = right ? new Vector2(.176f, .234f) : new Vector2(.807f, .234f);
        }
        if (actor == "liselotte") {
            elbowPoint = right ? new Vector2(.630f,.594f) : new Vector2(.381f,.602f);
            wristPoint = right ? new Vector2(.178f,.195f) : new Vector2(.744f,.206f);
        }
        var extent = new Vector2(art.width/pixels, art.height/pixels);
        Vector3 Point(Vector2 uv) => origin + (Vector3)Vector2.Scale(uv,extent);
        elbow = Bone("Elbow",shoulder,Point(elbowPoint));
        wrist = Bone("Wrist",elbow,Point(wristPoint)-Point(elbowPoint));
        bool dancer = actor == "daier";
        var knucklePoint = right ? new Vector2(.146f, .139f) : new Vector2(.866f, .139f);
        if (dancer) knuckles = Bone("Knuckles",wrist,Point(knucklePoint)-Point(wristPoint));
        var elbowLocal = Point(elbowPoint);
        var wristLocal = Point(wristPoint);
        var forearmAxis = (wristLocal-elbowLocal).normalized;
        var elbowAxis = (forearmAxis + elbowLocal.normalized).normalized;
        bool useClavicleBlend = actor == "siwei" && right;
        BoneWeight Weights(Vector2 uv) {
            var point = Point(uv);
            if (uv.y > .82f) {
                float shoulderWeight = Mathf.InverseLerp(.99f, .82f, uv.y);
                if (dancer) {
                    // Anchor the inner clavicle and let the outer shoulder cap
                    // travel with the sleeve when the arm opens.
                    float outward = (right ? -point.x : point.x)/extent.x;
                    float capWeight = Mathf.InverseLerp(-.075f,.15f,outward);
                    shoulderWeight = Mathf.Max(shoulderWeight,capWeight);
                }
                if (useClavicleBlend) {
                    float lateralDistance = -(point.x + .4f * point.y) / extent.x;
                    float acrossClavicle = Mathf.InverseLerp(-.097f, .186f, lateralDistance);
                    float belowShoulder = Mathf.InverseLerp(.885f, .82f, uv.y);
                    shoulderWeight = Mathf.Max(acrossClavicle, belowShoulder);
                }
                return WeightedArt.Blend(0, 1, Mathf.SmoothStep(0, 1, shoulderWeight));
            }
            if (dancer && uv.y < knucklePoint.y + .032f)
                return WeightedArt.Blend(3,4,Mathf.SmoothStep(0,1,Mathf.InverseLerp(knucklePoint.y+.032f,knucklePoint.y-.032f,uv.y)));
            float belowWrist = Vector3.Dot(point-wristLocal,forearmAxis)/extent.y;
            if (belowWrist > -.06f) return WeightedArt.Blend(2,3,Mathf.SmoothStep(0,1,Mathf.InverseLerp(-.06f,.06f,belowWrist)));
            float belowElbow = Vector3.Dot(point-elbowLocal,elbowAxis)/extent.y;
            float elbowBlend = dancer ? .066f : .105f;
            return WeightedArt.Blend(1,2,Mathf.SmoothStep(0,1,Mathf.InverseLerp(-elbowBlend,elbowBlend,belowElbow)));
        }
        skin = new WeightedArt(actor+(right?" right arm":" left arm"), shoulder, art, origin, pixels, order,
            dancer ? new[] {shoulder.parent, shoulder, elbow, wrist, knuckles} : new[] {shoulder.parent, shoulder, elbow, wrist}, Weights,
            useClavicleBlend || actor == "daier" ? 20 : 8, useClavicleBlend || actor == "daier" ? 72 : 36);
    }

    private static Transform Bone(string name,Transform parent,Vector3 offset) {
        var joint=new GameObject(name).transform; joint.SetParent(parent,false); joint.localPosition=offset; return joint;
    }
    public void Pose(float bend,float flex) { elbow.localRotation=Quaternion.Euler(0,0,bend); wrist.localRotation=Quaternion.Euler(0,0,flex); }
    public void PoseDance(float bend, float forward, float flex, float fingers) {
        elbow.localRotation = Quaternion.Euler(forward,0,bend);
        wrist.localRotation = Quaternion.Euler(-forward*.35f,0,flex);
        knuckles.localRotation = Quaternion.Euler(0,0,fingers);
    }
    public void Tint(Color color) { skin.Tint(color); }
}

internal sealed class WeightedArt
{
    private readonly SkinnedMeshRenderer skin;
    private readonly MaterialPropertyBlock properties = new MaterialPropertyBlock();
    private static Material shared;

    public static BoneWeight Blend(int first, int second, float weight)
    {
        return weight <= .5f
            ? new BoneWeight {boneIndex0=first,weight0=1-weight,boneIndex1=second,weight1=weight}
            : new BoneWeight {boneIndex0=second,weight0=weight,boneIndex1=first,weight1=1-weight};
    }

    public WeightedArt(string name, Transform parent, Texture2D art, Vector3 origin, float pixels, int order,
        Transform[] bones, System.Func<Vector2,BoneWeight> weightsAt, int cols = 8, int rows = 36,
        SkinQuality quality = SkinQuality.Auto)
    {
        skin = new GameObject(name).AddComponent<SkinnedMeshRenderer>();
        skin.transform.SetParent(parent,false);
        if (!shared) shared = new Material(Shader.Find("Sprites/Default"));
        skin.sharedMaterial = shared;
        skin.sortingOrder = order;
        skin.bones = bones;
        skin.rootBone = parent;
        skin.updateWhenOffscreen = true;
        skin.quality = quality;
        var extent = new Vector2(art.width/pixels, art.height/pixels);
        var verts=new Vector3[(cols+1)*(rows+1)]; var coords=new Vector2[verts.Length];
        var weights=new BoneWeight[verts.Length]; var indices=new int[cols*rows*6];
        var colors=new Color32[verts.Length];
        int next=0;
        for(int row=0;row<=rows;row++) for(int col=0;col<=cols;col++) {
            int index=row*(cols+1)+col;
            var uv=new Vector2((float)col/cols,(float)row/rows);
            coords[index]=uv; verts[index]=origin+(Vector3)Vector2.Scale(uv,extent); colors[index]=new Color32(255,255,255,255);
            weights[index]=weightsAt(uv);
            if(row==rows || col==cols) continue;
            int above=index+cols+1;
            indices[next++]=index; indices[next++]=above; indices[next++]=index+1;
            indices[next++]=index+1; indices[next++]=above; indices[next++]=above+1;
        }
        var mesh=new Mesh{name=name,vertices=verts,uv=coords,colors32=colors,triangles=indices,boneWeights=weights};
        var bind=new Matrix4x4[bones.Length];
        for(int index=0; index<bones.Length; index++) bind[index]=bones[index].worldToLocalMatrix*skin.transform.localToWorldMatrix;
        mesh.bindposes=bind; mesh.RecalculateBounds(); skin.sharedMesh=mesh;
        properties.SetTexture("_MainTex",art); Tint(new Color(.93f,.95f,1));
    }

    public void Tint(Color color) { properties.SetColor("_Color",color); skin.SetPropertyBlock(properties); }
}
