using System;
using System.Linq;
using UnityEngine;
using UnityEngine.UIElements;

public sealed partial class BattleHud
{
    void DrawTop() {
        var round=Box(topLayer,38,25,180,78);Cut(round,0,0,162,48,Ink);Box(round,0,0,4,48,Cyan);
        Text(round,"回合",12,0,53,47,18,White);Text(round,state.round.ToString("00"),62,-2,82,49,37,White,TextAnchor.MiddleCenter,true);
        Cut(round,0,53,118,24,Tint("202735"));Text(round,"波次   1 / 1",10,52,105,25,15,White);
        if (units.TryGetValue(state.boss,out var chief)) {
            var bossBlock=Box(topLayer,566,27,790,68);Hit(bossBlock,()=>Open(chief.id));
            Art(bossBlock,"ribbon",0,0,790,62);Art(bossBlock,chief.id+"-face",3,3,51,51,ScaleMode.ScaleAndCrop);
            Text(bossBlock,chief.name,65,0,235,31,23,White);Text(bossBlock,"首领",297,4,75,24,15,Muted);
            int offset=0;foreach(var element in chief.weaknesses){Art(bossBlock,element,409+offset,3,26,26);offset+=28;}
            Text(bossBlock,chief.hp+" / "+chief.maxHp,500,-1,235,31,22,White,TextAnchor.MiddleRight,true);
            Bar(bossBlock,chief.id,65,35,670,12,(float)chief.hp/chief.maxHp,Tint("F48150"),true);Bar(bossBlock,"",65,53,670,4,chief.tough,Tint("90ADC9"));
            DrawIcons(bossBlock,chief,735-29*Math.Min(5,chief.statuses.Length),64);
        }
        var tools=Box(topLayer,1597,27,285,43);
        Tool(tools,0,68,"×"+state.speed,()=>Signal("speed"),false);Tool(tools,76,88,"自动",()=>Signal("auto"),state.auto);Tool(tools,172,81,"菜单",()=>Open("menu"),false);
    }
    void Tool(VisualElement parent,float x,float width,string title,Action action,bool active) {
        var button=Box(parent,x,0,width,38);Cut(button,0,0,width,38,active?Cyan:Ink,6);
        Text(button,title,0,0,width-4,37,19,active?Ink:White,TextAnchor.MiddleCenter);Hit(button,action);
    }
    void DrawOrder() {
        var lane=Box(orderLayer,214,29,350,85);
        for (int index=0;index<state.order.Length;index++) {
            var entry=state.order[index];if(!units.TryGetValue(entry.id,out var unit))continue;
            bool first=index==0;
            float size=first?56:43;
            float x=first?0:62+(index-1)*46;
            var row=Box(lane,x,first?0:6,size,size,first?Cyan:ColorFor(unit.id));
            Round(row,size/2);
            var face=Box(row,2,2,size-4,size-4,Ink);Round(face,size/2-2);
            Art(face,unit.id+"-face",1,1,size-6,size-6,ScaleMode.ScaleAndCrop);
            var meter=Box(lane,x+2,first?55:49,size-4,first?22:20);
            Cut(meter,0,0,size-4,first?22:20,first?Cyan:Ink,5);
            Text(meter,first?"行动中":entry.value,0,-1,size-6,first?23:21,first?14:15,first?Ink:White,TextAnchor.MiddleCenter,!first);
            Hit(meter,()=>Open(unit.id));
            Hit(row,()=>Open(unit.id));
        }
        var secondary=Box(orderLayer,1660,78,221,38);
        Tool(secondary,0,74,"支援",()=>Open("support"),false);
        Tool(secondary,78,108,"即时调度",()=>Open("dispatch"),false);
    }
    void DrawTargets() {
        foreach(var foe in state.foes) {
            if(!foe.alive)continue;
            var head=Box(targetLayer,0,0,200,70);anchored[foe.node]=head;
            if(foe.id!=state.boss){Art(head,"ribbon",9,9,168,33);Text(head,foe.name,17,7,110,28,17,White);
                for(int ix=0;ix<foe.weaknesses.Length;ix++)Art(head,foe.weaknesses[ix],117+ix*21,12,19,19);
                Bar(head,foe.id,12,40,160,6,(float)foe.hp/foe.maxHp,Tint("FA8076"),true);Bar(head,"",12,50,160,3,foe.tough,Tint("ACC0DF"));}
            if(state.actor!="" && (state.mode=="all" || state.mode=="enemy" && state.selected==foe.id)) {
                AttachLock(foe);
            }
            if(foe.id!=state.boss && foe.statuses.Length>0)DrawIcons(head,foe,10,-19);
            if(state.mode=="enemy" || state.mode=="all") {var pick=Box(head,5,81,190,205);Hit(pick,()=>Signal("target/"+foe.id));}
            if(foe.id!=state.boss){var info=Box(head,10,8,165,45);Hit(info,()=>Open(foe.id));}
        }
    }
    void DrawIcons(VisualElement parent,Unit unit,float x,float y) {
        for(int index=0;index<Math.Min(5,unit.statuses.Length);index++) {
            var effect=unit.statuses[index];var icon=Box(parent,x+index*29,y,26,26,Ink);
            bool hostile=effect.icon.StartsWith("dot") || effect.icon.StartsWith("debuff") || effect.icon.StartsWith("ctrl");
            Box(icon,0,23,26,3,hostile?Tint("FFA06C"):Cyan);Art(icon,effect.icon,1,0,24,24);
            Text(icon,effect.count,10,12,16,15,13,White,TextAnchor.MiddleRight,true);Hit(icon,()=>Open(unit.id));
        }
    }
    void DrawPartyCard(VisualElement parent,int index) {
        const float cardWidth = 184, cardGap = 34, cardHeight = 182;
        var unit = state.allies[index];
        var tint = ColorFor(unit.id);
        bool active = state.actor == unit.id;
        bool picked = state.mode == "ally" && state.selected == unit.id;
        float x = 70 + index * (cardWidth + cardGap);
        float y = 1080 - 18 - cardHeight - (active ? 8 : 0);
        var card = Box(parent, x, y, cardWidth, cardHeight);
        card.style.opacity = unit.alive ? 1f : .50f;
        void SelectUnit() { if (state.mode == "ally") Signal("target/" + unit.id); else Open(unit.id); }
        var portrait = Art(card, unit.id + "-party", -10, -70, 204, 194, ScaleMode.ScaleToFit);
        Hit(portrait, SelectUnit);
        var plate = Box(card, 0, 103, cardWidth, 39);
        Art(plate, "ribbon", 0, 0, cardWidth, 39);
        Hit(card, SelectUnit);
        if (active || picked) Cut(plate, 0, 0, 111, 4, picked ? Cyan : tint, 4);
        float charge = Mathf.Clamp01((float)unit.energy / Math.Max(1, unit.maxEnergy));
        DrawUltimateDial(card, unit, index, charge, tint);
        Art(plate, "party-el-" + unit.element, -3, -4, 46, 46);
        Text(plate, unit.hp.ToString(), 47, 0, 119, 40, 32, White, TextAnchor.MiddleLeft, true);
        Bar(card,unit.id,4,143,170,7,(float)unit.hp/unit.maxHp,unit.hp<unit.maxHp*.35f?Gold:Tint("79E9B2"),true);
        Bar(card,"",4,153,170,3,charge,Tint("78DCDD"));
        var energy=Box(card,0,158,43,24);Art(energy,"ribbon",0,0,43,24);Text(energy,unit.energy.ToString(),4,-1,40,25,18,White,TextAnchor.MiddleLeft,true);
        DrawIcons(card,unit,cardWidth - 29 * Math.Min(5,unit.statuses.Length),158);
        if(unit.damage>0)Text(card,"本轮  "+unit.damage,0,-98,cardWidth,26,17,Gold);
    }
    void DrawUltimateDial(VisualElement card, Unit unit, int index, float charge, Color accent) {
        bool ready = unit.alive && unit.ready;
        float size = ready ? 76 : 62;
        float radius = size / 2;
        var dial = Box(card, 156 - radius, 70 - radius, size, size, Ink);
        Round(dial, radius);
        var center = new Vector2(radius, radius);
        dial.generateVisualContent += context => {
            var pen = context.painter2D;
            void Arc(float inset, float weight, Color color, float degrees) {
                pen.lineWidth = weight;
                pen.strokeColor = color;
                pen.BeginPath();
                pen.Arc(center, radius - inset, Angle.Degrees(-90), Angle.Degrees(-90 + degrees));
                pen.Stroke();
            }
            Arc(4, 5, Tint("4A515F"), 359.95f);
            if (charge > 0) Arc(4, 5, accent, charge * 359.95f);
            if (ready) Arc(9, 2, White, 359.95f);
        };
        float inset = ready ? 11 : 8;
        float diameter = size - 2 * inset;
        var core = Box(dial, inset, inset, diameter, diameter);
        Round(core, diameter / 2);
        Art(core, unit.id + "-ultimate", 0, 0, diameter, diameter);
        if (!ready) Box(core, 0, 0, diameter, diameter, Tint("0E142C86"));
        Hit(dial, () => Signal("ult/" + unit.id));
        if (ready) {
            var key = Box(card, 176, 28, 23, 23, White);
            Round(key, 12);
            Text(key, (index + 1).ToString(), 0, 0, 23, 23, 16, Ink, TextAnchor.MiddleCenter, true);
            Hit(key, () => Signal("ult/" + unit.id));
        }
    }
    void DrawSkills() {
        if (!units.TryGetValue(state.actor ?? "", out var actor)) return;
        var active = state.skills.FirstOrDefault(skill => skill.id == state.slot);
        if (active == null) return;
        var dock = Box(skillLayer, 1355, 805, 520, 251);
        string targetType = state.mode switch {
            "all" => "敌方全体", "ally" => "我方单体", "enemy" when actor.id == "vera" && active.id == "skill" => "扩散攻击",
            "enemy" => "敌方单体", _ => "我方全体"
        };
        Art(dock, "ribbon", 0, 0, 427, 45);
        Box(dock, 0, 0, 5, 45, Gold);
        Text(dock, active.name, 13, -1, 295, 46, 32, White);
        Text(dock, targetType, 300, 3, 100, 40, 16, White, TextAnchor.MiddleRight);
        for (int index = 0; index < state.skills.Length; index++) {
            var skill = state.skills[index];
            bool selected = active == skill;
            const float pitch = 138;
            float size = selected ? 126 : 104;
            var slot = Box(dock, index * pitch, 53, 134, 155);
            Hit(slot, () => Signal("slot/" + skill.id));
            float offset = (134 - size) / 2;
            var frame = Box(slot, offset, 126 - size, size, size, selected ? Gold : Tint("566170"));
            Art(frame, actor.id + "-" + skill.id, 2, 2, size-4, size-4);
            if (!selected) Box(frame, 2, 2, size-4, size-4, skill.available ? Tint("10152030") : Tint("10152099"));
            if (selected) {
                foreach (float edge in new[] { 0f, size }) {
                    float start = edge == 0 ? -4 : size-19;
                    Box(frame, start, -4, 23, 5, Gold);
                    Box(frame, start, size-1, 23, 5, Gold);
                    Box(frame, edge- (edge == 0 ? 4 : 1), -4, 5, 17, Gold);
                    Box(frame, edge- (edge == 0 ? 4 : 1), size-13, 5, 17, Gold);
                }
            }
            var key = Box(frame, 2, 2, 29, 25);
            Cut(key, 0, 0, 29, 25, selected ? Gold : Ink, 5);
            string shortcut = skill.id switch { "basic" => "Q", "skill" => "E", _ => "R" };
            Text(key, shortcut, 0, 0, 24, 25, 17, selected ? Ink : White, TextAnchor.MiddleCenter, true);
            string cost = skill.id switch {
                "basic" => "+1", "skill" when !skill.available => "能量点不足", "skill" => "-1", _ => actor.energy + "/" + actor.maxEnergy
            };
            Cut(slot, offset, 129, size, 24, Ink, 6);
            bool numeric = skill.id != "skill" || skill.available;
            Text(slot, cost, offset, 127, size, 28, numeric ? 19 : 15, skill.available ? White : Muted, TextAnchor.MiddleCenter, numeric);
        }
        Art(dock, "ribbon", 0, 217, 406, 33);
        Text(dock, "能量点", 8, 217, 78, 33, 16, White);
        for (int index = 0; index < state.maxPoints; index++)
            Cut(dock, 85+index*21, 228, 17, 11, index < state.points ? Cyan : Tint("4B5360"), 4);
        Text(dock, state.points + " / " + state.maxPoints, 200, 216, 85, 34, 20, White, TextAnchor.MiddleLeft, true);
        var confirm = Box(dock, 414, 105, 100, 80);
        Hit(confirm, () => Signal("confirm"));
        Cut(confirm, 0, 13, 100, 53, Ink, 10);
        Text(confirm, "施放", 3, 11, 88, 32, 22, White, TextAnchor.MiddleCenter);
        Text(confirm, "空格", 3, 42, 88, 22, 14, Muted, TextAnchor.MiddleCenter);
    }
}
