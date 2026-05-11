import {
  Building2,
  Camera,
  Coffee,
  Landmark,
  Map,
  Mountain,
  type LucideIcon,
} from "lucide-react";

export type BeenToLocation = {
  id: string;
  slug?: string;
  name?: string;
  country?: string;
  region?: string;
  continent?: string;
  lat?: number;
  lon?: number;
  heroImage: string | null;
  photoCount: number;
};

export type BeenToDestination = {
  id: string;
  slug?: string;
  name: string;
  country: string;
  continent: string;
  flavor: string;
  image: string;
  accent: string;
  icon: LucideIcon;
  objectPosition: string;
  layoutClass: string;
  photoCount: number;
};

export type BeenToLocationWithImage = BeenToLocation & {
  heroImage: string;
};

export type BeenToImageDimensions = {
  height: number;
  ratio: number;
  width: number;
};

export type BeenToStat = {
  label: string;
  value: number;
};

const accentStyles = [
  "#f97316",
  "#8b5cf6",
  "#22c55e",
  "#06b6d4",
  "#ef4444",
];

const icons = [Building2, Landmark, Coffee, Mountain, Map, Camera];

const primaryLayoutClasses = [
  "lg:col-start-1 lg:col-span-2 lg:row-start-3 lg:row-span-4",
  "lg:col-start-3 lg:col-span-2 lg:row-start-3 lg:row-span-4",
  "lg:col-start-5 lg:col-span-2 lg:row-start-3 lg:row-span-4",
  "lg:col-start-7 lg:col-span-2 lg:row-start-3 lg:row-span-4",
  "lg:col-start-9 lg:col-span-2 lg:row-start-3 lg:row-span-4",
];

const archiveLayoutClasses = [
  "lg:col-span-4 lg:row-span-2",
  "lg:col-span-5 lg:row-span-2",
  "lg:col-span-3 lg:row-span-3",
  "lg:col-span-6 lg:row-span-2",
  "lg:col-span-3 lg:row-span-2",
];

const flavorNames = [
  "Memory Box Special",
  "Passport Plate",
  "Detour Crunch",
  "Window Seat Bite",
  "Postcard Blend",
];

export function toBeenToDestinations(
  locations: BeenToLocationWithImage[],
  options: {
    dimensionsByImage?: Record<string, BeenToImageDimensions>;
    primary?: boolean;
  } = {},
) {
  const layouts = options.primary ? primaryLayoutClasses : archiveLayoutClasses;

  return locations.map((location, index) => ({
    id: location.id,
    slug: location.slug,
    name: location.name ?? toTitleCase(location.slug ?? `Location ${index + 1}`),
    country: location.country ?? "Global archive",
    continent: location.continent ?? "World",
    flavor: buildFlavor(location, index),
    image: location.heroImage,
    accent: accentStyles[index % accentStyles.length],
    icon: icons[index % icons.length],
    objectPosition: "center",
    layoutClass:
      getDynamicLayoutClass(options.dimensionsByImage?.[location.heroImage], options.primary) ??
      layouts[index % layouts.length],
    photoCount: location.photoCount,
  })) satisfies BeenToDestination[];
}

export function buildBeenToStats(locations: BeenToLocation[]): BeenToStat[] {
  return [
    {
      label: "places",
      value: locations.length,
    },
    {
      label: "countries",
      value: countUnique(locations.map((location) => location.country)),
    },
    {
      label: "continents",
      value: countUnique(locations.map((location) => location.continent)),
    },
    {
      label: "photos",
      value: locations.reduce((sum, location) => sum + location.photoCount, 0),
    },
  ];
}

function buildFlavor(location: BeenToLocation, index: number) {
  const place = location.region ?? location.country ?? location.continent;

  if (place) {
    return `${place} ${flavorNames[index % flavorNames.length]}`;
  }

  return flavorNames[index % flavorNames.length];
}

function countUnique(values: Array<string | undefined>) {
  return new Set(values.filter((value): value is string => Boolean(value))).size;
}

function getDynamicLayoutClass(
  dimensions: BeenToImageDimensions | undefined,
  primary: boolean | undefined,
) {
  if (!dimensions) {
    return null;
  }

  if (dimensions.ratio <= 0.76) {
    return primary ? "lg:col-span-2 lg:row-span-4" : "lg:col-span-3 lg:row-span-4";
  }

  if (dimensions.ratio >= 1.5) {
    return "lg:col-span-6 lg:row-span-2";
  }

  if (dimensions.ratio >= 1.1) {
    return "lg:col-span-4 lg:row-span-2";
  }

  return "lg:col-span-3 lg:row-span-3";
}

function toTitleCase(value: string) {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
