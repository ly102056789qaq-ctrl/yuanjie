using System.Collections;
using UnityEngine;

public sealed class ArenaBeast : MonoBehaviour
{
    public Animation rig;
    public AnimationClip idle, attack, hit, death;
    private Coroutine transition;
    private bool defeated;

    private void Awake()
    {
        rig.AddClip(idle, "Idle");
        rig.AddClip(attack, "Attack");
        rig.AddClip(hit, "Hit");
        rig.AddClip(death, "Death");
        rig["Idle"].wrapMode = WrapMode.Loop;
    }

    public void ResetPose()
    {
        CancelTransition();
        defeated = false;
        rig.Stop();
        rig.Play("Idle");
    }

    public void React(string motion, float speed)
    {
        if (defeated || !isActiveAndEnabled) return;
        CancelTransition();
        defeated = motion == "Death";
        var state = rig[motion];
        state.speed = speed > 0 ? speed : 1;
        state.time = 0;
        state.wrapMode = WrapMode.ClampForever;
        rig.CrossFade(motion, .075f / state.speed);
        transition = StartCoroutine(Finish(state.length / state.speed));
    }

    private IEnumerator Finish(float seconds)
    {
        yield return new WaitForSeconds(seconds);
        transition = null;
        if (defeated) transform.parent.gameObject.SetActive(false);
        else rig.CrossFade("Idle", .12f);
    }

    private void CancelTransition()
    {
        if (transition != null) StopCoroutine(transition);
        transition = null;
    }
}
