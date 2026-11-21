Shader "Yuanjie/AtlasAdd" {
    Properties { [PerRendererData] _MainTex ("Atlas", 2D) = "black" {} }
    SubShader {
        Tags { "Queue"="Transparent" "RenderType"="Transparent" }
        Cull Off ZWrite Off Blend One OneMinusSrcColor
        Pass {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "UnityCG.cginc"
            struct Vertex { float4 position : POSITION; float2 uv : TEXCOORD0; fixed4 color : COLOR; };
            struct Fragment { float4 position : SV_POSITION; float2 uv : TEXCOORD0; fixed4 color : COLOR; };
            sampler2D _MainTex;
            Fragment vert(Vertex input) { Fragment output; output.position = UnityObjectToClipPos(input.position); output.uv = input.uv; output.color=input.color; return output; }
            fixed4 frag(Fragment input) : SV_Target { return tex2D(_MainTex, input.uv)*input.color*input.color.a; }
            ENDCG
        }
    }
}
