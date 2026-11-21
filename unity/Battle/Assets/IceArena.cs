using UnityEngine;

public static class IceArena
{
    public static SpriteRenderer Decal(Transform parent, string textureName, Vector3 position, float width, float depth, int order)
    {
        var texture = Resources.Load<Texture2D>("Stage/"+textureName);
        var renderer = new GameObject(textureName).AddComponent<SpriteRenderer>();
        renderer.transform.SetParent(parent,false);
        renderer.transform.localPosition=position;
        renderer.transform.localRotation=Quaternion.Euler(90,0,0);
        renderer.transform.localScale=new Vector3(width,depth*texture.width/texture.height,1);
        renderer.sprite=Sprite.Create(texture,new Rect(0,0,texture.width,texture.height),new Vector2(.5f,.5f),texture.width,0,SpriteMeshType.FullRect);
        renderer.sortingOrder=order;
        return renderer;
    }

    public static void Build(Transform stage, SpriteRenderer backdrop, Vector3 referenceEye)
    {
        var floor=new GameObject("Pressure-fractured ice shelf");
        floor.transform.SetParent(stage,false);
        floor.AddComponent<MeshFilter>().sharedMesh=FracturedIce.Build();
        var ice=new Material(Resources.Load<Shader>("IceSurface"));
        ice.mainTexture=Resources.Load<Texture2D>("Stage/Ice");
        var backdropBounds=backdrop.bounds;
        ice.SetTexture("_Landscape",backdrop.sprite.texture);
        ice.SetVector("_ProjectionEye",referenceEye);
        ice.SetVector("_BackdropOrigin",backdropBounds.min);
        ice.SetVector("_BackdropSize",backdropBounds.size);
        floor.AddComponent<MeshRenderer>().sharedMaterial=ice;
        var channel = new GameObject();
        channel.AddComponent<MeshFilter>().sharedMesh = Resources.GetBuiltinResource<Mesh>("Plane.fbx");
        channel.AddComponent<MeshRenderer>();
        channel.name="Water below the floes";
        channel.transform.SetParent(stage,false);
        channel.transform.localPosition=new Vector3(0,-.92f,4);
        channel.transform.localScale=new Vector3(4.5f,1,2.9f);
        var water = new Material(ice);
        water.SetFloat("_Water",1);
        channel.GetComponent<MeshRenderer>().sharedMaterial=water;
        var lamp=new GameObject("Moon key").AddComponent<Light>();
        lamp.type=LightType.Directional; lamp.color=new Color(.84f,.91f,1); lamp.intensity=.92f;
        lamp.transform.rotation=Quaternion.Euler(42,-32,0);
        RenderSettings.ambientMode=UnityEngine.Rendering.AmbientMode.Flat;
        RenderSettings.ambientLight=new Color(.31f,.37f,.48f);
    }

    public static Transform Beast(Transform parent)
    {
        var model=Object.Instantiate(Resources.Load<GameObject>("Stage/Prowler"),parent).transform;
        model.localRotation=Quaternion.Euler(0,-28,0);
        var parts=model.GetComponentsInChildren<Renderer>();
        Bounds bounds=parts[0].bounds;
        foreach(var part in parts) bounds.Encapsulate(part.bounds);
        model.localScale*=2.15f/bounds.size.y;
        bounds=parts[0].bounds;
        foreach(var part in parts) {
            bounds.Encapsulate(part.bounds);
            foreach(var material in part.materials) {
                string label=material.name.ToLowerInvariant();
                if(label.Contains("ceramic")) { material.color=new Color(.65f,.73f,.81f); material.SetFloat("_Glossiness",.34f); }
                if(label.Contains("ion") || label.Contains("filament") || label.Contains("sapphire")) {
                    material.EnableKeyword("_EMISSION");
                    material.SetColor("_EmissionColor",new Color(.02f,.72f,1)*1.3f);
                }
            }
        }
        model.position+=new Vector3(parent.position.x-bounds.center.x,parent.position.y-bounds.min.y,parent.position.z-bounds.center.z);
        return model;
    }
}
