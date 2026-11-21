using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.InteropServices;
using UnityEngine;
using UnityEngine.UIElements;

public sealed partial class BattleHud : MonoBehaviour
{
    [Serializable] sealed class Status { public string name, icon, count, detail; }
    [Serializable] sealed class Unit {
        public string id, node, name, element;
        public bool alive, ready;
        public int hp, maxHp, energy, maxEnergy, damage;
        public float tough;
        public string[] weaknesses;
        public Status[] statuses;
    }
    [Serializable] sealed class Order { public string id, value; }
    [Serializable] sealed class Skill { public string id, name; public bool available; }
    [Serializable] sealed class Model {
        public bool visible, auto;
        public int round, points, maxPoints, speed;
        public string actor, slot, mode, selected, boss, warning, cast, total, domain, result, summary;
        public Unit[] allies, foes;
        public Skill[] skills;
        public Order[] order;
        public Status[] domains;
    }
    [DllImport("__Internal")] static extern void CommandHudSignal(string command);
    static readonly Dictionary<string, Vector3> anchors = new();
    readonly Dictionary<string, VisualElement> anchored = new();
    readonly Dictionary<string, Texture2D> art = new();
    readonly Dictionary<string, Unit> units = new();
    readonly Dictionary<string, float> previousHp = new(), lagUntil = new();
    readonly Dictionary<string, (VisualElement fill, float width, float end)> trails = new();
    static readonly Color Ink = Tint("121724"), White = Tint("F7F5EF"), Muted = Tint("B6C5CF"), Cyan = Tint("9AF0EA"), Gold = Tint("FFD38E");
    Font textFont, numberFont;
    UIDocument document;
    PanelSettings settings;
    VisualElement stage, overlay, topLayer, orderLayer, targetLayer, partyLayer, skillLayer, noticeLayer;
    string topKey, orderKey, targetsKey, skillsKey, noticeKey;
    readonly List<(string key, string unit, VisualElement view)> partyCards = new();
    Model state;
    string panelId = "";
    bool painted;
    float fit = 1, left, top;
    int screenWidth, screenHeight;

    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
    static void Initialize() { if (GameObject.Find("BattleStage") && !GameObject.Find("CommandHud")) new GameObject("CommandHud").AddComponent<BattleHud>(); }
    public static void Track(string node, float x, float y, float height) { anchors[node] = new Vector3(x,y,height); }
    static void Signal(string command) {
#if UNITY_WEBGL && !UNITY_EDITOR
        CommandHudSignal(command);
#endif
    }
    static Color Tint(string hex) { return ColorUtility.TryParseHtmlString("#"+hex, out var color) ? color : Color.white; }
    static Color ColorFor(string id) => id switch { "siwei"=>Tint("A9A9FA"),"dekeke"=>Tint("FFC475"),"vera"=>Tint("C9A5FF"),"rin"=>Tint("92EEC9"),"shen"=>Tint("FFAB68"),"eliot"=>Tint("99E3FF"),_=>Tint("FF967F") };
    void Awake() {
        textFont = Resources.Load<Font>("CommandHud/CommandSans"); numberFont = Resources.Load<Font>("CommandHud/CommandNumber");
        settings = ScriptableObject.CreateInstance<PanelSettings>();
        settings.themeStyleSheet = Resources.Load<ThemeStyleSheet>("CommandHud/CommandTheme");
        settings.scaleMode = PanelScaleMode.ConstantPixelSize;
        document = gameObject.AddComponent<UIDocument>(); document.panelSettings = settings;
        document.rootVisualElement.pickingMode = PickingMode.Ignore;
        stage = Box(document.rootVisualElement,0,0,1920,1080);
        topLayer = Box(stage,0,0,1920,1080);
        orderLayer = Box(stage,0,0,1920,1080);
        targetLayer = Box(stage,0,0,1920,1080);
        partyLayer = Box(stage,0,0,1920,1080);
        skillLayer = Box(stage,0,0,1920,1080);
        noticeLayer = Box(stage,0,0,1920,1080);
        overlay = Box(stage,0,0,1920,1080);
        feedback = Box(document.rootVisualElement,0,0,1920,1080);
        Resize(); Signal("ready");
    }
    void OnDestroy() { if (settings) Destroy(settings); }
    void Resize() {
        screenWidth=Screen.width; screenHeight=Screen.height;
        fit=Mathf.Max(.1f,Mathf.Min(screenWidth/1920f,screenHeight/1080f)); settings.scale=fit;
        left=(screenWidth/fit-1920)/2; top=(screenHeight/fit-1080)/2;
        stage.style.left=left; stage.style.top=top;
        feedback.style.left=left; feedback.style.top=top;
    }
    void LateUpdate() {
        if (screenWidth!=Screen.width || screenHeight!=Screen.height) Resize();
        UpdateFeedback();
        foreach (var item in anchored) if (anchors.TryGetValue(item.Key,out var point)) {
            item.Value.style.translate = new Translate(point.x*screenWidth/fit-left-100,(point.y-point.z)*screenHeight/fit-top-78);
        }
        foreach (var pair in trails) {
            float progress = Mathf.Clamp01((lagUntil[pair.Key]-Time.unscaledTime)/.55f);
            pair.Value.fill.style.width = Mathf.Lerp(pair.Value.end,previousHp[pair.Key],progress)*pair.Value.width;
        }
    }
    public void SetState(string json) {
        var next=JsonUtility.FromJson<Model>(json); if (next?.allies==null) return;
        if (state!=null && state.result!="" && next.result=="") { previousHp.Clear(); lagUntil.Clear(); trails.Clear(); panelId=""; }
        if (state!=null) foreach (var unit in next.allies.Concat(next.foes)) {
            if (units.TryGetValue(unit.id,out var old) && old.hp>unit.hp) {
                previousHp[unit.id]=Mathf.Clamp01((float)old.hp/Mathf.Max(1,old.maxHp));lagUntil[unit.id]=Time.unscaledTime+.55f;
            }
        }
        state=next; units.Clear(); foreach(var unit in next.allies.Concat(next.foes)) units[unit.id]=unit;
        Draw(); if (!painted) {painted=true;Signal("painted");}
    }
    static void Rect(VisualElement item,float x,float y,float width,float height) {
        item.style.position=Position.Absolute;item.style.left=x;item.style.top=y;item.style.width=width;item.style.height=height;
        item.pickingMode=PickingMode.Ignore;
    }
    static VisualElement Box(VisualElement parent,float x,float y,float width,float height,Color? color=null) {
        var el=new VisualElement();Rect(el,x,y,width,height);if(color.HasValue)el.style.backgroundColor=color.Value;parent.Add(el);return el;
    }
    static void Round(VisualElement node,float radius) {
        node.style.borderTopLeftRadius=radius;node.style.borderTopRightRadius=radius;
        node.style.borderBottomLeftRadius=radius;node.style.borderBottomRightRadius=radius;node.style.overflow=Overflow.Hidden;
    }
    Label Text(VisualElement parent,string value,float x,float y,float width,float height,int size,Color color,TextAnchor align=TextAnchor.MiddleLeft,bool number=false) {
        var label=new Label(value);Rect(label,x,y,width,height);label.style.marginLeft=0;label.style.marginRight=0;label.style.marginTop=0;label.style.marginBottom=0;
        label.style.paddingLeft=0;label.style.paddingRight=0;label.style.paddingTop=0;label.style.paddingBottom=0;
        label.style.fontSize=size;label.style.color=color;label.style.unityTextAlign=align;
        label.style.unityFontDefinition=FontDefinition.FromFont(number?numberFont:textFont);
        parent.Add(label);return label;
    }
    VisualElement Art(VisualElement parent,string id,float x,float y,float width,float height,ScaleMode mode=ScaleMode.StretchToFill) {
        if (!art.TryGetValue(id,out var tex)) {tex=Resources.Load<Texture2D>("CommandHud/"+id);art[id]=tex;}
        var img=new Image { image=tex,scaleMode=mode };Rect(img,x,y,width,height);parent.Add(img);return img;
    }
    static void Hit(VisualElement el,Action action) {
        el.pickingMode=PickingMode.Position;
        el.userData=action;
#if !UNITY_WEBGL || UNITY_EDITOR
        el.RegisterCallback<ClickEvent>(evt=>{evt.StopPropagation();action();});
#endif
    }
    [Serializable] sealed class PointerPosition { public float x,y; }
    public void ClickAt(string json) {
        if (state==null || !state.visible) return;
        var input=JsonUtility.FromJson<PointerPosition>(json);
        var point=new Vector2(input.x*Screen.width/fit,input.y*Screen.height/fit);
        var element=stage.panel?.Pick(point);
        while (element!=null) {
            if (element.userData is Action action) { action();return; }
            element=element.parent;
        }
    }
    static void Cut(VisualElement parent,float x,float y,float width,float height,Color color,float notch=9) {
        var shape=Box(parent,x,y,width,height);
        shape.generateVisualContent+=context=>{var pen=context.painter2D;pen.fillColor=color;pen.BeginPath();pen.MoveTo(Vector2.zero);
            pen.LineTo(new Vector2(width,0));pen.LineTo(new Vector2(width-notch,height));pen.LineTo(new Vector2(0,height));pen.ClosePath();pen.Fill();};
    }
    void Bar(VisualElement parent,string key,float x,float y,float width,float height,float ratio,Color color,bool trail=false) {
        ratio=Mathf.Clamp01(ratio);
        Box(parent,x-2,y-2,width+4,height+4,Tint("080E1A"));
        Box(parent,x-1,y-1,width+2,1,Tint("A3A7AF"));
        Box(parent,x,y,width,height,Tint("292330"));
        Box(parent,x-1,y+height,width+2,1,Tint("596171"));
        if (trail && lagUntil.TryGetValue(key,out var until) && until>Time.unscaledTime) {
            var old=Box(parent,x,y,width*previousHp[key],height,White); trails[key]=(old,width,ratio);
        }
        Box(parent,x,y,width*ratio,height,color);
        if (height >= 6) {
            Box(parent,x,y,width*ratio,1.5f,Color.Lerp(color,White,.75f));
            Box(parent,x,y+height-2,width*ratio,2,Tint("21192754"));
            int sections = width > 500 ? 8 : 4;
            for (int index=1;index<sections;index++) Box(parent,x+Mathf.Round(width*index/sections),y,1.5f,height,Tint("1015249E"));
            if (ratio>0 && ratio<1) Box(parent,x+Mathf.Max(0,width*ratio-2),y-1,2,height+2,White);
        }
    }
    void Draw() {
        stage.style.display=state.visible?DisplayStyle.Flex:DisplayStyle.None;
        if (!state.visible) { lockStarts.Clear(); targetsKey=null; return; }
        string unitKey(Unit unit) => JsonUtility.ToJson(unit);
        var chiefKey = units.TryGetValue(state.boss,out var chief) ? unitKey(chief) : "";
        var nextTop = $"{state.round}/{state.auto}/{state.speed}/{chiefKey}";
        if (nextTop!=topKey) {
            topKey=nextTop; topLayer.Clear();
            if (chief!=null) trails.Remove(chief.id);
            DrawTop();
        }
        var nextOrder=string.Join("|",state.order.Select(row=>row.id+":"+row.value));
        if (nextOrder!=orderKey) {orderKey=nextOrder;orderLayer.Clear();DrawOrder();}
        var nextTargets=state.actor+"/"+state.mode+"/"+state.selected+"/"+state.boss+"/"+string.Join("|",state.foes.Select(unitKey));
        if (nextTargets!=targetsKey) {
            targetsKey=nextTargets; targetLayer.Clear(); anchored.Clear(); locks.Clear();
            foreach (var foe in state.foes) if (foe.id!=state.boss) trails.Remove(foe.id);
            DrawTargets();
            foreach (var key in lockStarts.Keys.Where(key => !locks.Exists(mark=>mark.node==key)).ToArray()) lockStarts.Remove(key);
        }
        for (int i=0;i<state.allies.Length;i++) {
            var ally=state.allies[i];
            var nextKey=unitKey(ally)+"/"+(state.actor==ally.id)+"/"+(state.mode=="ally" && state.selected==ally.id);
            if (i>=partyCards.Count) partyCards.Add((null,null,Box(partyLayer,0,0,1920,1080)));
            var card=partyCards[i];
            if (nextKey==card.key) continue;
            if (card.unit!=null) trails.Remove(card.unit);
            card.view.Clear(); DrawPartyCard(card.view,i);
            partyCards[i]=(nextKey,ally.id,card.view);
        }
        while (partyCards.Count>state.allies.Length) {
            int i=partyCards.Count-1; var card=partyCards[i];
            trails.Remove(card.unit); card.view.RemoveFromHierarchy(); partyCards.RemoveAt(i);
        }
        string nextSkills=state.actor+"/"+state.slot+"/"+state.mode+"/"+state.points+"/"+state.maxPoints;
        if (units.TryGetValue(state.actor ?? "",out var acting))
            nextSkills += "/"+acting.energy+"/"+acting.maxEnergy+"/"+string.Join("|",state.skills.Select(skill=>skill.id+skill.name+skill.available));
        if(nextSkills!=skillsKey) {skillsKey=nextSkills;skillLayer.Clear();DrawSkills();}
        var notices=state.cast+"/"+state.domain+"/"+state.warning+"/"+state.total;
        if(notices!=noticeKey) {noticeKey=notices;noticeLayer.Clear();DrawNotices();}
        overlay.Clear();
        if (!string.IsNullOrEmpty(state.result)) DrawResult(); else if(panelId!="") DrawPanel();
    }
    void DrawNotices() {
        if (!string.IsNullOrEmpty(state.cast)) Banner(state.cast,130,30);
        if (!string.IsNullOrEmpty(state.domain)) Banner(state.domain,397,38);
        if (!string.IsNullOrEmpty(state.warning)) Banner(state.warning,725,21);
        if (!string.IsNullOrEmpty(state.total)) {var total=Box(noticeLayer,1525,160,250,85);Art(total,"ribbon",0,0,250,80);Text(total,"总伤害",14,0,220,25,16,Muted);Text(total,state.total,14,22,225,54,46,Gold,TextAnchor.MiddleLeft,true);}
    }
    void Banner(string value,float y,int size) {
        var banner=Box(noticeLayer,725,y,470,52);Art(banner,"ribbon",0,0,470,52);Box(banner,0,0,5,52,Gold);Text(banner,value,15,0,430,52,size,White,TextAnchor.MiddleCenter);
    }
}
