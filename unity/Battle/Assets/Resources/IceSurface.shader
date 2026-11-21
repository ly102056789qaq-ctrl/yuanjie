Shader "Yuanjie/IceSurface" {
 Properties { _MainTex ("Ice surface", 2D) = "white" {} _Landscape ("Ice field painting", 2D) = "black" {} _Water ("Water", Float) = 0 }
 SubShader { Tags { "RenderType"="Opaque" } Pass {
 CGPROGRAM
 #pragma vertex vert
 #pragma fragment frag
 #include "UnityCG.cginc"
 struct Input { float4 vertex:POSITION; float4 color:COLOR; float3 normal:NORMAL; };
 struct Varying { float4 position:SV_POSITION; float3 world:TEXCOORD0; float4 color:COLOR; float3 normal:TEXCOORD1; };
 sampler2D _MainTex, _Landscape;
 sampler2D _YJSeaLines;
 float _YJSeaLevel, _YJSeaTime;
 float3 _ProjectionEye, _BackdropOrigin, _BackdropSize;
 float _Water;
 Varying vert(Input data) { Varying output; output.position=UnityObjectToClipPos(data.vertex); output.world=mul(unity_ObjectToWorld,data.vertex).xyz; output.color=data.color; output.normal=UnityObjectToWorldNormal(data.normal); return output; }
 fixed4 frag(Varying data):SV_Target {
   float3 ray=data.world-_ProjectionEye;
   float distanceToPlate=(_BackdropOrigin.z-_ProjectionEye.z)/max(.1,ray.z);
   float2 uv=(_ProjectionEye.xy+ray.xy*distanceToPlate-_BackdropOrigin.xy)/_BackdropSize.xy;
   float3 painted=tex2D(_Landscape,saturate(uv)).rgb;
   float2 frostUV=data.world.xz*float2(.14,.21)+float2(.32,.41);
   float3 frost=tex2D(_MainTex,frostUV).rgb;
   float inside=min(min(uv.x,1-uv.x),uv.y);
   float3 ice=lerp(frost*.81,painted,smoothstep(.0,.075,inside));
   float foreground=1-smoothstep(6.,16.,data.world.z);
   ice*=1+foreground*((frost.b-.40)*.26+(data.color.g-.89)*.11);
   float3 viewDir=normalize(_WorldSpaceCameraPos-data.world);
   float rim=saturate(1-dot(viewDir,float3(0,1,0)));
   float glint=smoothstep(.50,.86,frost.b)*rim*foreground;
   ice+=float3(.033,.062,.085)*glint;
   if(data.color.r<.84) {
      float sideLight=saturate(dot(normalize(data.normal),normalize(float3(-.5,.64,-.6))));
      float3 wall=lerp(ice,frost,float3(.28,.33,.39));
      float layers=sin(data.world.y*49+frost.b*7)*.5+.5;
      float3 transmission=float3(.024,.067,.096)*(.38+.62*sideLight)*layers;
      ice=data.color.r>.5 ? ice*1.07+float3(.006,.010,.014) : wall*lerp(.63,.84,saturate(data.world.y+.92))+transmission;
   }
   if(_Water>.5) ice=ice*float3(.55,.68,.78)+float3(.015,.036,.055);
   if (_YJSeaLevel > .001) {
      float2 field = data.world.xz - float2(0, .65);
      float radius = length(field * float2(.87, 1));
      float crest = abs(frac(radius * .29 - _YJSeaTime * .21 + .5) - .5);
      float ripple = 1 - smoothstep(.009, .040, crest);
      float2 patternUV = field * .107 + float2(.009, -.013) * _YJSeaTime;
      float network = tex2D(_YJSeaLines, frac(patternUV)).r;
      float falloff = 1 - smoothstep(6, 14, radius);
      float3 deepSea = ice * float3(.49, .46, .88) + float3(.015,.014,.065);
      float3 signal = lerp(float3(.18,.50,.90), float3(.60,.36,.91), saturate(radius*.11));
      ice = lerp(ice, deepSea + falloff * signal * (ripple*.62 + network*.29), _YJSeaLevel);
   }
   return fixed4(ice,1);
 }
 ENDCG
 } }
}
