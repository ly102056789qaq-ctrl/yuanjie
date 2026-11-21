using UnityEngine;
using UnityEngine.Playables;
using UnityEngine.Timeline;

public sealed class RinShot : PlayableAsset
{
    public int shot;
    public override Playable CreatePlayable(PlayableGraph graph, GameObject owner)
    {
        var playable = ScriptPlayable<RinShotFrame>.Create(graph);
        playable.GetBehaviour().shot = shot;
        return playable;
    }
}

public sealed class RinShotFrame : PlayableBehaviour
{
    public int shot;
    public override void ProcessFrame(Playable playable, FrameData info, object playerData)
    {
        var stage = playerData as BattleStage;
        if (stage && info.effectiveWeight>0) stage.CineFrame(shot,(float)(playable.GetTime()/playable.GetDuration()));
    }
}
