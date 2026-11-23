"""
PBR materials from the curated CC0 texture set (tools/art/textures.json), colour-graded towards
the ART_BIBLE palette so every asset shares one look. Box projection: no UV unwrapping needed.
"""

from __future__ import annotations

import pathlib

import bpy

from .scene import hex_rgba

ROOT = pathlib.Path(__file__).resolve().parents[3]
TEX = ROOT / "assets/src/textures"


def _image(path: pathlib.Path, non_color: bool) -> bpy.types.Image | None:
    if not path.exists():
        return None
    img = bpy.data.images.load(str(path), check_existing=True)
    if non_color:
        img.colorspace_settings.name = "Non-Color"
    return img


def _tex_node(nodes, img, vector_socket, links, blend: float):
    node = nodes.new("ShaderNodeTexImage")
    node.image = img
    node.projection = "BOX"
    node.projection_blend = blend
    links.new(vector_socket, node.inputs["Vector"])
    return node


def pbr_layer(nodes, links, key: str, **kwargs):
    """Builds a Principled BSDF fed by the texture set `key`; returns the BSDF node."""
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    sockets = pbr_sockets(nodes, links, key, **kwargs)
    links.new(sockets["color"], bsdf.inputs["Base Color"])
    if sockets["roughness"] is not None:
        links.new(sockets["roughness"], bsdf.inputs["Roughness"])
    if sockets["normal"] is not None:
        links.new(sockets["normal"], bsdf.inputs["Normal"])
    return bsdf


def pbr_sockets(nodes, links, key: str, *, scale: float = 1.0, tint: str | None = None,
                tint_amount: float = 0.0, saturation: float = 0.8, value: float = 1.0,
                roughness: float = 1.0, normal_strength: float = 1.0, coords: str = "Object",
                blend: float = 0.3) -> dict:
    """Texture outputs (colour, roughness, normal) of the set `key`, for blending before shading."""
    folder = TEX / key
    coord = nodes.new("ShaderNodeTexCoord")
    mapping = nodes.new("ShaderNodeMapping")
    mapping.inputs["Scale"].default_value = (scale, scale, scale)
    links.new(coord.outputs[coords], mapping.inputs["Vector"])
    vec = mapping.outputs["Vector"]
    result = {"color": None, "roughness": None, "normal": None}

    color_img = _image(folder / "Color.jpg", False)
    if color_img is None:
        raise FileNotFoundError(f"Missing texture set '{key}'. Run: python3 tools/art/fetch_textures.py")
    color = _tex_node(nodes, color_img, vec, links, blend)
    hsv = nodes.new("ShaderNodeHueSaturation")
    hsv.inputs["Saturation"].default_value = saturation
    hsv.inputs["Value"].default_value = value
    links.new(color.outputs["Color"], hsv.inputs["Color"])
    out_color = hsv.outputs["Color"]

    ao_img = _image(folder / "AmbientOcclusion.jpg", True)
    if ao_img is not None:
        ao = _tex_node(nodes, ao_img, vec, links, blend)
        mul = nodes.new("ShaderNodeMix")
        mul.data_type, mul.blend_type = "RGBA", "MULTIPLY"
        mul.inputs["Factor"].default_value = 0.8
        links.new(out_color, mul.inputs["A"])
        links.new(ao.outputs["Color"], mul.inputs["B"])
        out_color = mul.outputs["Result"]

    if tint and tint_amount > 0:
        mix = nodes.new("ShaderNodeMix")
        mix.data_type, mix.blend_type = "RGBA", "COLOR"
        mix.inputs["Factor"].default_value = tint_amount
        links.new(out_color, mix.inputs["A"])
        mix.inputs["B"].default_value = hex_rgba(tint)
        out_color = mix.outputs["Result"]
    result["color"] = out_color

    rough_img = _image(folder / "Roughness.jpg", True)
    if rough_img is not None:
        rough = _tex_node(nodes, rough_img, vec, links, blend)
        rmul = nodes.new("ShaderNodeMath")
        rmul.operation = "MULTIPLY"
        rmul.use_clamp = True
        rmul.inputs[1].default_value = roughness
        links.new(rough.outputs["Color"], rmul.inputs[0])
        result["roughness"] = rmul.outputs["Value"]

    normal_img = _image(folder / "NormalGL.jpg", True)
    if normal_img is not None:
        ntex = _tex_node(nodes, normal_img, vec, links, blend)
        nmap = nodes.new("ShaderNodeNormalMap")
        nmap.inputs["Strength"].default_value = normal_strength
        links.new(ntex.outputs["Color"], nmap.inputs["Color"])
        result["normal"] = nmap.outputs["Normal"]
    return result


_cache: dict[str, bpy.types.Material] = {}


def pbr(name: str, key: str, **kwargs) -> bpy.types.Material:
    """Single-layer PBR material (cached by name)."""
    if name in _cache and _cache[name].name in bpy.data.materials:
        return _cache[name]
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    nodes.remove(nodes["Principled BSDF"])
    bsdf = pbr_layer(nodes, links, key, **kwargs)
    links.new(bsdf.outputs["BSDF"], nodes["Material Output"].inputs["Surface"])
    _cache[name] = mat
    return mat


def flat(name: str, color: str, roughness: float = 0.8, metallic: float = 0.0,
         emission: str | None = None, strength: float = 0.0) -> bpy.types.Material:
    if name in _cache and _cache[name].name in bpy.data.materials:
        return _cache[name]
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = hex_rgba(color)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if emission:
        bsdf.inputs["Emission Color"].default_value = hex_rgba(emission)
        bsdf.inputs["Emission Strength"].default_value = strength
    _cache[name] = mat
    return mat


def reset_cache() -> None:
    _cache.clear()


# ---- the district palette of materials (one place to tune the whole look) ----

def district_materials() -> dict[str, bpy.types.Material]:
    return {
        "planks": pbr("Planks", "wood_siding", scale=1.6, saturation=0.6, value=1.15, tint="#6B5443", tint_amount=0.2),
        "planks_pale": pbr("PlanksPale", "wood_beam", scale=1.6, saturation=0.55, value=1.05, tint="#7A6A58", tint_amount=0.3),
        "beam": pbr("Beam", "wood_beam", scale=2.5, saturation=0.45, value=0.7, tint="#4A3A2E", tint_amount=0.35),
        "roof_rust": pbr("RoofRust", "corrugated_rust", scale=1.2, saturation=0.65, value=0.8, tint="#8E4B2E", tint_amount=0.45),
        "roof_dark": pbr("RoofDark", "corrugated_dark", scale=1.2, saturation=0.35, value=0.42, roughness=1.2, tint="#3A3B3F", tint_amount=0.2),
        "roof_tar": pbr("RoofTar", "roof_tar", scale=1.5, saturation=0.3, value=0.75),
        "stone": pbr("Stone", "stone_blocks", scale=1.4, saturation=0.35, value=0.7, tint="#4A4D52", tint_amount=0.3),
        "rock": pbr("Rock", "rock_dark", scale=0.6, saturation=0.35, value=0.42, tint="#4A4D52", tint_amount=0.2),
        "metal_rust": pbr("MetalRust", "metal_rust", scale=1.5, saturation=0.55, value=0.6, tint="#5A3426", tint_amount=0.4),
        "coal": pbr("Coal", "dirt_coal", scale=2.0, saturation=0.2, value=0.35),
        "soot": flat("Soot", "#1E1D21", roughness=0.9),
        "iron": flat("Iron", "#3A3B3F", roughness=0.45, metallic=0.8),
        "glass_lit": flat("GlassLit", "#2B2A2E", roughness=0.3, emission="#E8A24A", strength=7.0),
        "glass_dark": flat("GlassDark", "#1A1E24", roughness=0.15),
        "lamp": flat("Lamp", "#E8A24A", emission="#FFC37A", strength=14.0),
        "cloth": flat("Cloth", "#6E6A5E", roughness=0.95),
        "cloth_red": flat("ClothRed", "#7A2E26", roughness=0.95),
        "leaves": flat("Leaves", "#2F3F2A", roughness=0.85),
        "bark": pbr("Bark", "wood_beam", scale=3.0, saturation=0.3, value=0.45),
    }
