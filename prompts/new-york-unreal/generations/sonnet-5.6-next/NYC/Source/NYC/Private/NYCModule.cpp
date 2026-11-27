#include "NYC.h"
#include "Modules/ModuleManager.h"
#include "Misc/Paths.h"
#include "ShaderCore.h"

DEFINE_LOG_CATEGORY(LogNYC);

// Loads at PostConfigInit so the /Project/NYC shader directory exists before materials compile.
class FNYCModule : public FDefaultGameModuleImpl
{
public:
	virtual void StartupModule() override
	{
		const FString ShaderDir = FPaths::Combine(FPaths::ProjectDir(), TEXT("Shaders"));
		if (!AllShaderSourceDirectoryMappings().Contains(TEXT("/NYC")))
		{
			AddShaderSourceDirectoryMapping(TEXT("/NYC"), ShaderDir);
		}
	}
};

IMPLEMENT_PRIMARY_GAME_MODULE(FNYCModule, NYC, "NYC");
