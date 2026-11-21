Shader "Yuanjie/Element Splash"
{
    Properties {
        Main_tex ("Packed particle atlas", 2D) = "white" {}
        Vector1_930B327D ("Highlight min", Float) = -10
        Vector1_270105AC ("Highlight max", Float) = -1
    }
    SubShader {
        Tags { "Queue"="Transparent" "RenderType"="Transparent" "IgnoreProjector"="True" }
        Blend SrcAlpha OneMinusSrcAlpha
        ZWrite Off
        Cull Off
        Pass {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "UnityCG.cginc"
            sampler2D Main_tex;
            UNITY_DECLARE_DEPTH_TEXTURE(_CameraDepthTexture);
            float Vector1_930B327D, Vector1_270105AC;
            struct Particle {
                float4 vertex : POSITION;
                fixed4 color : COLOR;
                float2 uv : TEXCOORD0;
                float4 custom : TEXCOORD1;
                float4 highlight : TEXCOORD2;
            };
            struct Varyings {
                float4 position : SV_POSITION;
                fixed4 color : COLOR;
                float2 uv : TEXCOORD0;
                float4 custom : TEXCOORD1;
                float4 highlight : TEXCOORD2;
                float4 screen : TEXCOORD3;
            };
            Varyings vert(Particle v) {
                Varyings o;
                o.position = UnityObjectToClipPos(v.vertex);
                o.screen = ComputeScreenPos(o.position);
                COMPUTE_EYEDEPTH(o.screen.z);
                o.uv=v.uv; o.custom=v.custom; o.highlight=v.highlight; o.color=v.color;
                return o;
            }
            fixed4 frag(Varyings i) : SV_Target {
                float warp = tex2D(Main_tex,i.uv).b * i.custom.z;
                fixed4 mask = tex2D(Main_tex,i.uv + float2(warp,0));
                float edge = mask.g + 1 - i.custom.x;
                float low = -i.custom.x * i.custom.y;
                float opacity = saturate(lerp(low,1,edge / (1 + .1 * i.custom.x)));
                float highlight = saturate(lerp(Vector1_930B327D,Vector1_270105AC,edge));
                float3 color = lerp(i.color.rgb * mask.r * opacity,i.highlight.rgb,highlight*i.color.a*i.highlight.a);
                float sceneDepth = LinearEyeDepth(SAMPLE_DEPTH_TEXTURE_PROJ(_CameraDepthTexture,UNITY_PROJ_COORD(i.screen)));
                return fixed4(color, mask.a * opacity * i.color.a * saturate((sceneDepth-i.screen.z)*i.custom.w));
            }
            ENDCG
        }
    }
}
