using System;
using System.Linq;
using UnityEngine;
using UnityEngine.UIElements;

public sealed partial class BattleHud
{
    void Open(string id) { panelId=id;Draw(); }

    void DrawPanel() {
        var dismiss=Box(overlay,0,0,1920,1080,Tint("10142066"));Hit(dismiss,()=>Open(""));
        var panel=Box(overlay,600,255,720,548,Tint("171D2A"));Hit(panel,()=>{});
        Box(panel,0,0,7,70,Cyan);var close=Box(panel,645,15,52,43,Ink);Text(close,"×",0,0,52,43,29,White,TextAnchor.MiddleCenter);Hit(close,()=>Open(""));
        if(!units.TryGetValue(panelId,out var unit)) {
            bool menu=panelId=="menu";
            Text(panel,menu?"战斗菜单":panelId=="support"?"支援":"即时调度",26,10,580,52,32,White);
            if(menu){Text(panel,"操作",29,103,550,40,22,Cyan);Text(panel,"Q / E    选择技能，再按一次施放",29,159,650,42,22,White);
                Text(panel,"A / D    切换目标　　　 空格    确认",29,214,650,42,22,White);
                Text(panel,"1—4    对应队员终结技",29,269,650,42,22,White);}
            else Text(panel,"本场战斗尚未开放",29,121,640,54,24,Muted);
            return;
        }
        Art(panel,unit.id+"-face",23,17,75,56,ScaleMode.ScaleAndCrop);Text(panel,unit.name,112,12,470,42,28,White);
        Text(panel,unit.hp+" / "+unit.maxHp,114,51,440,25,20,Muted,TextAnchor.MiddleLeft,true);
        Box(panel,25,89,667,2,Tint("414B5A"));var list=new ScrollView(ScrollViewMode.Vertical);Rect(list,26,110,665,412);list.pickingMode=PickingMode.Position;panel.Add(list);
        var rows=unit.statuses.Concat(state.domains).ToArray();
        if(rows.Length==0)Text(panel,"当前没有状态效果",29,122,625,45,22,Muted);
        foreach(var effect in rows) {
            var row=new VisualElement();row.style.flexShrink=0;row.style.height=128;list.Add(row);
            Art(row,effect.icon,2,4,37,37);Text(row,effect.name,53,0,363,44,22,White);Text(row,effect.count,443,0,155,43,23,Cyan,TextAnchor.MiddleRight,true);
            var body=Text(row,effect.detail,54,45,548,77,17,Muted,TextAnchor.UpperLeft);body.style.whiteSpace=WhiteSpace.Normal;
        }
    }
    void DrawResult() {
        var shade=Box(overlay,0,0,1920,1080,Tint("0C1120CC"));Hit(shade,()=>{});var result=Box(overlay,611,349,698,340,Ink);
        var accent=state.result=="战斗胜利"?Cyan:Tint("FFAE99");Cut(result,0,0,698,9,accent);Text(result,state.result,28,39,642,102,68,White,TextAnchor.MiddleCenter);
        Text(result,state.summary,24,154,650,49,24,Muted,TextAnchor.MiddleCenter);var restart=Box(result,235,238,228,58);Cut(restart,0,0,228,58,accent);
        Text(restart,"再来一局",0,0,213,58,24,Ink,TextAnchor.MiddleCenter);Hit(restart,()=>Signal("restart"));
    }
}
