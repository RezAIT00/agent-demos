using UnrealBuildTool;

public class NYC : ModuleRules
{
	public NYC(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
		PublicDependencyModuleNames.AddRange(new string[] {
			"Core", "CoreUObject", "Engine", "InputCore", "RenderCore", "RHI", "Projects",
			"ProceduralMeshComponent", "Json",
			"PhysicsCore", "Chaos", "ChaosSolverEngine", "GeometryCollectionEngine", "FieldSystemEngine", "Niagara", "ChaosCaching"
		});
		if (Target.bBuildEditor)
		{
			PrivateDependencyModuleNames.AddRange(new string[] {
				"UnrealEd", "AssetRegistry", "MeshDescription", "StaticMeshDescription", "LevelEditor"
			});
		}
	}
}
