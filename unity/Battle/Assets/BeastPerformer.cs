using System.Collections.Generic;
using UnityEngine;

public sealed class BeastPerformer : MonoBehaviour
{
    private sealed class Hinge
    {
        private readonly Transform joint;
        private readonly Quaternion rest;
        private readonly Vector3 pitchAxis, yawAxis;

        public Hinge(Transform bone, Vector3 pitch)
        {
            joint = bone;
            rest = bone.localRotation;
            pitchAxis = bone.InverseTransformDirection(pitch);
            yawAxis = bone.InverseTransformDirection(Vector3.up);
        }

        public void Pose(float pitch, float yaw = 0)
        {
            joint.localRotation = rest * Quaternion.AngleAxis(yaw, yawAxis) * Quaternion.AngleAxis(pitch, pitchAxis);
        }
    }

    private Hinge body, skull, jaw;
    private readonly Hinge[] tail = new Hinge[6];
    private readonly Hinge[,] legs = new Hinge[4,3];
    private float attackAt, impactAt, attackRate, impactRate, strength;

    private void Awake()
    {
        var mesh = GetComponentInChildren<SkinnedMeshRenderer>();
        var bones = new Dictionary<string,Transform>();
        foreach (var bone in mesh.bones) bones.Add(bone.name,bone);
        var forward = Vector3.ProjectOnPlane(bones["Skull"].position - bones["Chassis"].position,Vector3.up).normalized;
        var pitch = Vector3.Cross(forward,Vector3.up);
        Hinge Joint(string name) => new Hinge(bones[name],pitch);
        body = Joint("Chassis"); skull = Joint("Skull"); jaw = Joint("Jaw");
        for (int index = 0; index < tail.Length; index++) tail[index] = Joint("Tail" + index);
        string[] limbs = {"ForePort", "ForeStarboard", "HindPort", "HindStarboard"};
        for (int index = 0; index < limbs.Length; index++) {
            legs[index,0] = Joint(limbs[index] + "Upper");
            legs[index,1] = Joint(limbs[index] + "Lower");
            legs[index,2] = Joint(limbs[index] + "Foot");
        }
        mesh.updateWhenOffscreen = true;
    }

    private void OnEnable() { attackAt = impactAt = float.NegativeInfinity; attackRate = impactRate = 1; }
    public void Attack(float rate) { attackAt = Time.time; attackRate = rate > 0 ? rate : 1; }
    public void Hit(bool heavy,float rate) { impactAt = Time.time; impactRate = rate > 0 ? rate : 1; strength = heavy ? 1.3f : 1; }

    private static float Pulse(float elapsed, float duration)
    {
        if (elapsed <= 0 || elapsed >= duration) return 0;
        return Mathf.Sin(Mathf.PI * elapsed / duration);
    }

    private void LateUpdate()
    {
        float clock = Time.time * 2.1f;
        float attack = (Time.time - attackAt) * attackRate;
        float impact = (Time.time - impactAt) * impactRate;
        float windup = Pulse(attack,.30f);
        float strike = Pulse(attack-.24f,.45f);
        float recoil = (Pulse(impact,.29f) - .30f * Pulse(impact-.24f,.38f)) * strength;
        float tilt = Mathf.Sin(clock)*.65f + 4*windup - 6*strike + 5*recoil;
        body.Pose(tilt);
        skull.Pose(Mathf.Sin(clock-.45f)*1.7f + 8*windup - 12*strike + 12*recoil, -8*recoil);
        jaw.Pose(-2 - Mathf.Sin(clock)*1.5f - 23*windup - 8*strike - 10*recoil);
        for (int index = 0; index < tail.Length; index++) {
            float lash = Pulse(impact - index*.045f,.40f);
            tail[index].Pose(Mathf.Sin(clock-index*.52f)*1.6f - recoil,Mathf.Sin(clock*.7f-index*.47f)*3 + lash*6 - strike*2);
        }
        for (int index = 0; index < 4; index++) {
            float brace = index < 2 ? 5*recoil - 4*strike : -3*recoil + 3*windup;
            legs[index,0].Pose(-tilt + brace);
            legs[index,1].Pose(-1.8f*brace);
            legs[index,2].Pose(.8f*brace);
        }
    }
}
