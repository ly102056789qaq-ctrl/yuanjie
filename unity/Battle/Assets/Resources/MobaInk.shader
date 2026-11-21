Shader "Yuanjie/MobaInk" {
    Properties {
        _MainTex ("Particle", 2D) = "white" {}
        _Tail ("Ribbon", Float) = 0
        _Art ("Texture detail", Float) = 0
        _Ink ("Light", Color) = (1,.22,.85,1)
    }
    SubShader {
        Tags {"Queue"="Transparent" "RenderType"="Transparent"}
        Cull Off ZWrite Off Blend One OneMinusSrcAlpha
        Pass {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "UnityCG.cginc"
            sampler2D _MainTex;
            half4 _Ink;
            half _Tail, _Art;
            struct Vertex { float4 vertex:POSITION; float2 uv:TEXCOORD0; fixed4 color:COLOR; };
            struct Fragment { float4 pos:SV_POSITION; float2 uv:TEXCOORD0; fixed4 color:COLOR; };
            Fragment vert(Vertex input) {
                Fragment output; output.pos=UnityObjectToClipPos(input.vertex); output.uv=input.uv; output.color=input.color; return output;
            }
            half4 frag(Fragment input):SV_Target {
                half4 sampleColor=tex2D(_MainTex,input.uv);
                half mask=sampleColor.a;
                if (_Tail > .5) {
                    half crossSection = saturate(1 - 2 * abs(input.uv.y - .5));
                    half lanes = .5 + .5 * cos((input.uv.y - .5) * 86);
                    half envelope = pow(crossSection, 4) * (.10 + .58 * pow(lanes, 5));
                    mask *= sampleColor.r * envelope;
                }
                half alpha=saturate(mask*input.color.a);
                half3 ink=lerp(_Ink.rgb,input.color.rgb,.25);
                ink *= lerp(1, .12 + .88 * max(sampleColor.r, max(sampleColor.g, sampleColor.b)), _Art);
                return half4((ink + .20*mask)*alpha, alpha*.69);
            }
            ENDCG
        }
    }
}
