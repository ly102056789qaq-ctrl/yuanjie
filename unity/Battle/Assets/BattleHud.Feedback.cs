using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UIElements;

public sealed partial class BattleHud
{
    [Serializable] sealed class HudCue { public string kind, node, title, icon, unit, actor; public int speed; }
    sealed class TimedCue {
        public VisualElement view;
        public HudCue data;
        public float start, duration, width;
    }
    sealed class LockMark {
        public string node;
        public VisualElement view, rotor, core;
        public float start;
    }
    VisualElement feedback;
    readonly List<TimedCue> notes = new();
    readonly List<Rect> occupied = new();
    readonly List<LockMark> locks = new();
    TimedCue portraitCue;

    void AttachLock(Unit foe) {
        var mark = Box(targetLayer,0,0,116,116);
        bool weak = units.TryGetValue(state.actor,out var actor) && Array.IndexOf(foe.weaknesses,actor.element)>=0;
        var rotor = Art(mark,"lock-orbit",0,0,116,116);
        var core = Art(mark,"lock-core",0,0,116,116);
        if (weak) {
            var tag = Box(mark,15,-16,86,26);
            Cut(tag,0,0,86,26,Tint("103334E8"),6);
            Box(tag,0,0,3,26,Cyan);
            Art(tag,actor.element,6,2,22,22);
            LightText(tag,"克制",30,-1,50,27,18,Tint("BEFFF3"));
        }
        if (!lockStarts.TryGetValue(foe.node,out float start)) lockStarts[foe.node]=start=Time.unscaledTime;
        locks.Add(new LockMark {node=foe.node,view=mark,rotor=rotor,core=core,start=start});
    }
    readonly Dictionary<string,float> lockStarts = new();

    Label LightText(VisualElement parent,string value,float x,float y,float width,float height,int size,Color accent) {
        var label = Text(parent,value,x,y,width,height,size,White);
        label.style.textShadow = new TextShadow {offset=new Vector2(0,1),blurRadius=3,color=accent};
        return label;
    }
    public void ShowCue(string json) {
        var cue = JsonUtility.FromJson<HudCue>(json);
        if (cue == null || feedback == null) return;
        if (cue.kind == "reset") {
            feedback.Clear(); notes.Clear(); portraitCue=null; lockStarts.Clear();
            return;
        }
        if (state == null || string.IsNullOrEmpty(cue.title)) return;
        float pace = Mathf.Clamp(cue.speed,1,2);
        if (cue.kind == "ultimate") {
            portraitCue?.view.RemoveFromHierarchy();
            var view = Box(feedback,0,0,444,197);
            var accent = ColorFor(cue.unit);
            Cut(view,88,73,334,76,Tint("121725D9"),46);
            Cut(view,149,151,243,28,accent,27);
            Art(view,cue.unit+"-bust",141,-92,276,263);
            Cut(view,11,127,410,52,Ink,29);
            Cut(view,0,127,14,52,accent,10);
            Box(view,18,126,375,2,accent);
            LightText(view,cue.title,25,128,360,47,32,accent);
            Cut(view,173,178,212,25,Tint("151A29EB"),16);
            Text(view,cue.actor+"  /  终结技",176,178,185,24,14,White,TextAnchor.MiddleRight);
            portraitCue=new TimedCue {view=view,data=cue,start=Time.unscaledTime,duration=1.85f/Mathf.Sqrt(pace)};
            return;
        }
        if (string.IsNullOrEmpty(cue.node) || !anchors.ContainsKey(cue.node)) return;
        var old = notes.Find(item => item.data.node==cue.node && item.data.title==cue.title);
        if (old!=null) { old.start=Time.unscaledTime; return; }
        if (notes.Count>=16) { notes[0].view.RemoveFromHierarchy();notes.RemoveAt(0); }
        float width = Mathf.Clamp(45+cue.title.Length*21,105,286);
        var note = Box(feedback,0,0,width,32);
        var color = cue.kind=="buff" ? Tint("7BF0EB") : cue.kind=="debuff" ? Tint("FFB778") : Tint("CCD1D9");
        Art(note,"ribbon",0,1,width,30);
        Box(note,0,5,3,22,color);
        Art(note,cue.icon,7,2,27,27);
        var caption=LightText(note,cue.title,39,0,width-39,32,20,color);
        caption.style.color=Color.Lerp(color,White,.56f);
        notes.Add(new TimedCue {view=note,data=cue,start=Time.unscaledTime,duration=1.6f/Mathf.Sqrt(pace),width=width});
    }
    Vector2 WorldPoint(Vector3 anchor,float height) => new Vector2(anchor.x*screenWidth/fit-left,(anchor.y-anchor.z*height)*screenHeight/fit-top);
    static float EaseOut(float progress) => 1-Mathf.Pow(1-Mathf.Clamp01(progress),3);
    void UpdateFeedback() {
        if (state==null) return;
        float now=Time.unscaledTime;
        foreach (var mark in locks) {
            if (!anchors.TryGetValue(mark.node,out var anchor)) continue;
            var center=WorldPoint(anchor,.57f);
            float age=now-mark.start;
            mark.view.style.translate=new Translate(center.x-58,center.y-58);
            mark.rotor.style.rotate=new Rotate(Angle.Degrees(age*32));
            float scale=1+.38f*(1-EaseOut(age/.27f));
            mark.core.style.scale=new Scale(new Vector2(scale,scale));
            mark.rotor.style.opacity=.82f+.18f*Mathf.Sin(age*3.4f);
        }
        feedback.style.display=state.visible && string.IsNullOrEmpty(panelId) && string.IsNullOrEmpty(state.result) ? DisplayStyle.Flex : DisplayStyle.None;
        if (portraitCue!=null) {
            float age=now-portraitCue.start;
            if (age>=portraitCue.duration) { portraitCue.view.RemoveFromHierarchy(); portraitCue=null; }
            else {
                float enter=EaseOut(age/.22f), exit=Mathf.Clamp01((age-portraitCue.duration+.23f)/.23f);
                portraitCue.view.style.translate=new Translate(1468+220*(1-enter)+85*exit*exit,354);
                portraitCue.view.style.opacity=enter*(1-exit);
            }
        }
        occupied.Clear();
        for (int index=0;index<notes.Count;) {
            var note=notes[index]; float age=now-note.start;
            if (age>=note.duration || !anchors.TryGetValue(note.data.node,out var anchor)) {
                note.view.RemoveFromHierarchy(); notes.RemoveAt(index); continue;
            }
            var center=WorldPoint(anchor,.90f);
            float enter=EaseOut(age/.15f), exit=Mathf.Clamp01((age-note.duration+.28f)/.28f);
            float x=Mathf.Clamp(center.x-note.width/2,12,1908-note.width);
            float y=Mathf.Clamp(center.y-43-13*enter-15*exit,120,940);
            var bounds=new Rect(x,y,note.width+5,35);
            for (int lane=0;lane<notes.Count && occupied.Exists(other=>other.Overlaps(bounds));lane++) bounds.y-=36;
            occupied.Add(bounds);
            note.view.style.translate=new Translate(x+12*(1-enter),bounds.y);
            note.view.style.opacity=enter*(1-exit);
            index++;
        }
    }
}
