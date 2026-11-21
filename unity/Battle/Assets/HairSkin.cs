using UnityEngine;

internal sealed class HairSkin
{
    private readonly WeightedArt skin;
    private readonly Transform middle, leftTip, rightTip;
    private readonly float strength;
    private float middleDrive, tipDrive, middleVelocity, tipVelocity;
    private bool initialized;

    public HairSkin(Transform head, Texture2D texture, Vector3 origin, float pixels, bool front, int order)
    {
        strength = front ? .6f : 1f;
        var extent = new Vector2(texture.width, texture.height) / pixels;
        Vector3 Point(float x, float y) => origin + (Vector3)Vector2.Scale(extent, new Vector2(x,y));
        // The front locks join the artwork below the face. Keep those joins
        // and the entire fringe pinned before blending into the loose lengths.
        float pinned = front ? .39f : .71f;
        float branch = front ? .22f : .37f;
        middle = Bone("Hair mid", head, Point(.5f,pinned));
        leftTip = Bone("Hair tip L", middle, Point(.24f,branch)-middle.localPosition);
        rightTip = Bone("Hair tip R", middle, Point(.76f,branch)-middle.localPosition);

        BoneWeight Weights(Vector2 uv) {
            if (uv.y > branch)
                return WeightedArt.Blend(0,1,Mathf.SmoothStep(0,1,Mathf.InverseLerp(pinned,branch,uv.y)));
            float tip = Mathf.SmoothStep(0,1,Mathf.InverseLerp(branch,branch*.28f,uv.y));
            float side = Mathf.SmoothStep(0,1,Mathf.Abs(uv.x-.5f)/.12f);
            return WeightedArt.Blend(1,uv.x<.5f ? 2 : 3,tip*side);
        }
        skin = new WeightedArt(texture.name,head,texture,origin,pixels,order,
            new[]{head,middle,leftTip,rightTip},Weights,16,36);
    }

    private static Transform Bone(string name, Transform parent, Vector3 offset) {
        var bone=new GameObject(name).transform;
        bone.SetParent(parent,false);
        bone.localPosition=offset;
        return bone;
    }

    public void Pose(float clock, float drive, float deltaTime) {
        if (!initialized) {
            middleDrive=tipDrive=drive;
            initialized=true;
        }
        if (deltaTime>0) {
            middleDrive=Mathf.SmoothDamp(middleDrive,drive,ref middleVelocity,.15f,Mathf.Infinity,deltaTime);
            tipDrive=Mathf.SmoothDamp(tipDrive,middleDrive,ref tipVelocity,.23f,Mathf.Infinity,deltaTime);
        }
        float wind=2.2f*Mathf.Sin(clock)+.9f*Mathf.Sin(.63f*clock+.6f);
        float lag=Mathf.Clamp(middleDrive-drive,-9f,9f);
        middle.localRotation=Quaternion.Euler(0,0,strength*(wind+lag));
        float trailing=Mathf.Clamp(tipDrive-middleDrive,-8f,8f);
        float tipWind=2.9f*Mathf.Sin(clock-.58f);
        float spread=1.6f*Mathf.Sin(.81f*clock+.9f)+Mathf.Min(3,Mathf.Abs(lag)*.4f);
        leftTip.localRotation=Quaternion.Euler(0,0,strength*(tipWind+trailing-spread));
        rightTip.localRotation=Quaternion.Euler(0,0,strength*(tipWind+trailing+spread));
    }

    public void Tint(Color color) => skin.Tint(color);
}
