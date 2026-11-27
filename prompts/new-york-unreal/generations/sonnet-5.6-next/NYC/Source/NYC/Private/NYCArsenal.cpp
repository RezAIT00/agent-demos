// The tool registry.  Each tier registers its tools; this file fixes the order they are listed in,
// smallest first, which is also the order of DESTRUCTION.md, the in-game selector and the audit.
#include "NYCArsenal.h"
#include "NYCDestruction.h"
#include "NYC.h"

namespace
{
	const TCHAR* const ArsenalOrder[] = {
		// 1 hand tools
		TEXT("pebble"), TEXT("marbles"), TEXT("baseball"), TEXT("firecracker"), TEXT("cherry_bomb"), TEXT("claw_hammer"), TEXT("crowbar"), TEXT("hydrant_wrench"),
		TEXT("pickaxe"), TEXT("fire_axe"), TEXT("cutting_torch"), TEXT("chainsaw"), TEXT("sledgehammer"), TEXT("jackhammer"),
		// 2 charges and incendiaries
		TEXT("road_flare"), TEXT("fireworks"), TEXT("grenade"), TEXT("propane_rocket"), TEXT("thermite"), TEXT("breaching_charge"), TEXT("shaped_charge"),
		TEXT("dynamite"), TEXT("gas_leak"), TEXT("linear_charge"),
		// 3 machines and demolition
		TEXT("rocket_cart"), TEXT("runaway_taxi"), TEXT("garbage_truck"), TEXT("city_bus"), TEXT("monster_truck"), TEXT("steel_beam_drop"), TEXT("road_roller"),
		TEXT("container_drop"), TEXT("bulldozer"), TEXT("excavator"), TEXT("pile_driver"), TEXT("high_reach_shear"), TEXT("wrecking_ball"), TEXT("crane_collapse"),
		TEXT("topple_charges"), TEXT("implosion"),
		// 4 ordnance
		TEXT("cannonball"), TEXT("mortar"), TEXT("tank_shell"), TEXT("howitzer"), TEXT("rocket_salvo"), TEXT("plunging_rocket"), TEXT("ripple_charges"),
		TEXT("bunker_buster"), TEXT("thermobaric"), TEXT("naval_broadside"),
		// 5 city hazards, weather and the ground
		TEXT("water_main"), TEXT("manhole_cascade"), TEXT("arc_storm"), TEXT("hailstorm"), TEXT("tremor"), TEXT("microburst"), TEXT("gas_main"),
		TEXT("super_lightning"), TEXT("blizzard"), TEXT("flash_flood"), TEXT("hurricane"), TEXT("sinkhole"), TEXT("tornado"), TEXT("eruption"),
		TEXT("megaquake"), TEXT("wedge_tornado"), TEXT("tsunami"),
		// 6 absurd
		TEXT("anvil_rain"), TEXT("piano_drop"), TEXT("balloon_lift"), TEXT("pinball"), TEXT("rubber_duck"), TEXT("gravity_flip"), TEXT("giant_magnet"),
		TEXT("bowling_ball"), TEXT("giant_boot"), TEXT("giant_spring"),
		// 7 alien technology
		TEXT("cryo_bomb"), TEXT("gravity_gun"), TEXT("sonic_disruptor"), TEXT("plasma_cutter"), TEXT("nanite_swarm"), TEXT("antimatter"), TEXT("ufo_death_ray"),
		TEXT("ufo_tractor"), TEXT("alien_tripod"), TEXT("black_hole"), TEXT("ion_cannon"),
		// 8 world ending
		TEXT("kinetic_rod"), TEXT("meteor_small"), TEXT("meteor_large"), TEXT("tactical_nuke"), TEXT("strategic_nuke"), TEXT("planet_cracker"), TEXT("asteroid"),
	};

	TArray<FNYCTool> Build()
	{
		TArray<FNYCTool> All;
		NYCArsenal::RegisterHand(All);
		NYCArsenal::RegisterCharges(All);
		NYCArsenal::RegisterMachines(All);
		NYCArsenal::RegisterOrdnance(All);
		NYCArsenal::RegisterHazards(All);
		NYCArsenal::RegisterAbsurd(All);
		NYCArsenal::RegisterAlien(All);
		NYCArsenal::RegisterCataclysm(All);
		TMap<FString, int32> Rank;
		for (int32 i = 0; i < UE_ARRAY_COUNT(ArsenalOrder); ++i) Rank.Add(ArsenalOrder[i], i);
		for (const FNYCTool& T : All)
			if (!Rank.Contains(T.Id)) UE_LOG(LogNYC, Error, TEXT("Arsenal: %s has no place in the order"), *T.Id);
		All.StableSort([&Rank](const FNYCTool& A, const FNYCTool& B) { return Rank.FindRef(A.Id) < Rank.FindRef(B.Id); });
		return All;
	}
}

const TArray<FNYCTool>& NYCArsenal::Tools()
{
	static const TArray<FNYCTool> All = Build();
	return All;
}

const FNYCTool* NYCArsenal::Find(const FString& Id)
{
	return Tools().FindByPredicate([&Id](const FNYCTool& T) { return T.Id == Id; });
}

int32 NYCArsenal::IndexOf(const FString& Id)
{
	return Tools().IndexOfByPredicate([&Id](const FNYCTool& T) { return T.Id == Id; });
}

void NYCArsenal::Use(ANYCDestruction& D, const FString& Id, const FNYCAim& Aim)
{
	const FNYCTool* T = Find(Id);
	if (!T)
	{
		UE_LOG(LogNYC, Warning, TEXT("Arsenal: no tool called %s"), *Id);
		return;
	}
	D.ClearStreetsOfPeople();
	if (!D.EnsureLoaded()) return;
	UE_LOG(LogNYC, Display, TEXT("Tool %s at (%.0f, %.0f, %.0f) building %d"), *Id, Aim.Point.X, Aim.Point.Y, Aim.Point.Z, Aim.Building);
	T->Use(D, Aim);
}

FNYCAim NYCArsenal::MakeAim(ANYCDestruction& D, const FVector& Origin, const FVector& Dir)
{
	FNYCAim A;
	A.Origin = Origin;
	A.Dir = Dir.GetSafeNormal(UE_SMALL_NUMBER, FVector::ForwardVector);
	D.EnsureLoaded();
	if (D.Trace(Origin, A.Dir, 200000.f, A.Point, A.Normal, &A.Building) < 0.f)
	{
		// looking at the sky: the ground below the line of sight, or a point out ahead
		A.Point = A.Dir.Z < -0.02 ? Origin + A.Dir * (-Origin.Z / A.Dir.Z) : Origin + A.Dir * 8000.0;
		A.Point.Z = FMath::Max(A.Point.Z, 0.0);
		A.Normal = FVector::UpVector;
		A.Building = INDEX_NONE;
	}
	if (A.Building == INDEX_NONE) D.NearestBuilding(A.Point, 600.f, A.Building);
	return A;
}

const TCHAR* NYCArsenal::TierName(int32 Tier)
{
	static const TCHAR* Names[] = { TEXT(""), TEXT("Hand tools"), TEXT("Charges and fire"), TEXT("Machines and demolition"), TEXT("Artillery and ordnance"),
		TEXT("Hazards, weather and ground"), TEXT("Absurd"), TEXT("Alien technology"), TEXT("World ending") };
	return Names[FMath::Clamp(Tier, 0, 8)];
}
