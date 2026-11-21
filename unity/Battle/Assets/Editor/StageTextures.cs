using UnityEditor;
using UnityEngine;

public class StageTextures : AssetPostprocessor
{
    public override uint GetVersion() => 2;
    private void OnPreprocessTexture()
    {
        if (!assetPath.StartsWith("Assets/Resources/Stage/")) return;
        var texture = (TextureImporter)assetImporter;
        texture.npotScale = TextureImporterNPOTScale.None;
        texture.maxTextureSize = 4096;
        texture.textureCompression = TextureImporterCompression.Uncompressed;
        texture.alphaIsTransparency = true;
        bool floor = assetPath.EndsWith("/Ice.png");
        texture.mipmapEnabled = true;
        texture.filterMode = FilterMode.Trilinear;
        texture.mipMapBias = floor ? 0 : -.25f;
        texture.wrapMode = floor ? TextureWrapMode.Repeat : TextureWrapMode.Clamp;
        texture.anisoLevel = floor ? 8 : 1;
    }
}
