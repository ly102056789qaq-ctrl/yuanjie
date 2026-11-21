using System.Collections.Generic;
using UnityEngine;

public static class FracturedIce
{
    private static float Next(System.Random random, float low, float high)
    {
        return Mathf.Lerp(low, high, (float)random.NextDouble());
    }

    private static List<Vector2> Clip(List<Vector2> polygon, Vector2 middle, Vector2 normal)
    {
        var result = new List<Vector2>();
        var previous = polygon[polygon.Count - 1];
        float before = Vector2.Dot(previous - middle, normal);
        foreach (var current in polygon) {
            float after = Vector2.Dot(current - middle, normal);
            if ((before < 0) != (after < 0)) result.Add(Vector2.Lerp(previous, current, before / (before - after)));
            if (after <= 0) result.Add(current);
            previous = current;
            before = after;
        }
        return result;
    }

    private sealed class Surface
    {
        private readonly List<Vector3> vertices = new List<Vector3>();
        private readonly List<int> indices = new List<int>();
        private readonly List<Color> colors = new List<Color>();

        public void Triangle(Vector3 first, Vector3 second, Vector3 third, Color face)
        {
            int start = vertices.Count;
            vertices.Add(first); vertices.Add(second); vertices.Add(third);
            indices.Add(start); indices.Add(start + 1); indices.Add(start + 2);
            colors.Add(face); colors.Add(face); colors.Add(face);
        }

        public Mesh Finish()
        {
            var mesh = new Mesh {name = "Pressure ice / beveled plates and submerged walls"};
            mesh.SetVertices(vertices);
            mesh.SetColors(colors);
            mesh.SetTriangles(indices, 0);
            mesh.RecalculateNormals();
            mesh.RecalculateBounds();
            return mesh;
        }
    }

    private static Vector3 Position(Vector2 point, float height) => new Vector3(point.x, height, point.y);

    public static Mesh Build()
    {
        var random = new System.Random(7118);
        var seeds = new List<Vector2>();
        for (int row = -3; row <= 7; row++)
            for (int column = -6; column <= 6; column++)
                seeds.Add(new Vector2(column * 3.25f + Next(random,-1.02f,1.02f), row * 2.23f + Next(random,-.79f,.79f)));
        var mesh = new Surface();
        foreach (var seed in seeds) {
            var polygon = new List<Vector2> {new Vector2(-22,-8),new Vector2(22,-8),new Vector2(22,18),new Vector2(-22,18)};
            foreach (var other in seeds) {
                if (other == seed) continue;
                polygon = Clip(polygon,(seed + other) * .5f,other - seed);
                if (polygon.Count == 0) break;
            }
            if (polygon.Count < 3) continue;
            float margin = Mathf.Max(Mathf.InverseLerp(4.9f,8,Mathf.Abs(seed.x)), Mathf.InverseLerp(-1.6f,-4.5f,seed.y));
            float level = -.035f + Next(random,-.022f,.14f) * margin;
            float slope = Next(random,-.035f,.035f) * margin;
            float gap = Mathf.Lerp(.002f,.052f,margin);
            float rimWidth = Mathf.Lerp(.009f,.037f,margin);
            float rimRise = Mathf.Lerp(.004f,.021f,margin);
            float depth = Next(random,.55f,.91f);
            Color cap = new Color(1, Next(random,.77f,1),0,1);
            for (int index = 0; index < polygon.Count; index++) {
                var first = Vector2.Lerp(polygon[index], seed, gap);
                var second = Vector2.Lerp(polygon[(index+1)%polygon.Count], seed, gap);
                var lipA = Position(first,level+(first.x-seed.x)*slope);
                var lipB = Position(second,level+(second.x-seed.x)*slope);
                var innerA = Vector3.Lerp(lipA,Position(seed,level),rimWidth) + Vector3.up*rimRise;
                var innerB = Vector3.Lerp(lipB,Position(seed,level),rimWidth) + Vector3.up*rimRise;
                var bottomA = lipA - Vector3.up*depth;
                var bottomB = lipB - Vector3.up*depth;
                mesh.Triangle(Position(seed,level+rimRise),innerB,innerA,cap);
                var bevel = new Color(.7f,cap.g,0,1);
                mesh.Triangle(innerA,innerB,lipA,bevel);
                mesh.Triangle(lipA,innerB,lipB,bevel);
                var wall = new Color(.12f,cap.g,0,1);
                mesh.Triangle(lipA,lipB,bottomB,wall);
                mesh.Triangle(lipA,bottomB,bottomA,wall);
            }
        }
        return mesh.Finish();
    }
}
