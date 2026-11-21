Shader "Yuanjie/WraithSilk" {
    Properties { _MainTex ("Paint", 2D) = "white" {} _Color ("Tint", Color) = (1,1,1,1) }
    SubShader {
        Tags { "RenderType"="Opaque" }
        Cull Off
        Pass {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "UnityCG.cginc"
            sampler2D _MainTex; fixed4 _Color;
            struct Varyings { float4 clip : SV_POSITION; float2 uv : TEXCOORD0; float3 normal : TEXCOORD1; float3 eye : TEXCOORD2; };
            Varyings vert(appdata_base vertex) {
                Varyings output;
                output.clip = UnityObjectToClipPos(vertex.vertex);
                output.uv = vertex.texcoord.xy;
                output.normal = UnityObjectToWorldNormal(vertex.normal);
                output.eye = WorldSpaceViewDir(vertex.vertex);
                return output;
            }
            fixed4 frag(Varyings input) : SV_Target {
                float3 normal = normalize(input.normal);
                float shade = .74 + .31 * abs(dot(normal,normalize(float3(-.3,.63,-.72))));
                float rim = pow(1-saturate(abs(dot(normal,normalize(input.eye)))),3);
                return fixed4(tex2D(_MainTex,input.uv).rgb * _Color.rgb * shade + float3(.04,.10,.16)*rim,1);
            }
            ENDCG
        }
    }
}
