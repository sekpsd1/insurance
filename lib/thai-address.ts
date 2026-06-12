import rawAddressDatabase from '@/data/thai-address-db.json';

type CompactAddressDatabase = {
  data: unknown[];
  lookup?: string;
  words?: string;
};

type CompactNode = [string | number, CompactNode[] | string | string[]] | [string | number, string | number | false, CompactNode[] | string | string[]];

export type ThaiAddressEntry = {
  province: string;
  district: string;
  subDistrict: string;
  postalCode: string;
};

let cachedEntries: ThaiAddressEntry[] | null = null;

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b, 'th'));
}

function expandCompactAddressDatabase() {
  const database = rawAddressDatabase as CompactAddressDatabase;
  const lookup = database.lookup?.split('|') ?? [];
  const words = database.words?.split('|') ?? [];
  const useLookup = Boolean(database.lookup && database.words);
  const entries: ThaiAddressEntry[] = [];

  const expandText = (value: string | number) => {
    let text = typeof value === 'number' ? lookup[value] ?? '' : value;

    if (!useLookup) {
      return text;
    }

    return text.replace(/[A-Z]/gi, (matched) => {
      const charCode = matched.charCodeAt(0);
      const index = charCode < 97 ? charCode - 65 : 26 + charCode - 97;
      return words[index] ?? matched;
    });
  };

  (database.data as CompactNode[]).forEach((provinceNode) => {
    const province = expandText(provinceNode[0]);
    const childIndex = provinceNode.length === 3 ? 2 : 1;
    const districtNodes = provinceNode[childIndex] as CompactNode[];

    districtNodes.forEach((districtNode) => {
      const district = expandText(districtNode[0]);
      const subDistrictNodes = districtNode[childIndex] as CompactNode[];

      subDistrictNodes.forEach((subDistrictNode) => {
        const subDistrict = expandText(subDistrictNode[0]);
        const rawPostalCodes = subDistrictNode[childIndex];
        const postalCodes = Array.isArray(rawPostalCodes) ? rawPostalCodes : [rawPostalCodes];

        postalCodes.forEach((postalCode) => {
          entries.push({
            province,
            district,
            subDistrict,
            postalCode: String(postalCode)
          });
        });
      });
    });
  });

  return entries;
}

export function getThaiAddressEntries() {
  cachedEntries ??= expandCompactAddressDatabase();
  return cachedEntries;
}

export function getThaiProvinceOptions() {
  return uniqueSorted(getThaiAddressEntries().map((entry) => entry.province));
}

export function getThaiDistrictOptions(province: string) {
  return uniqueSorted(
    getThaiAddressEntries()
      .filter((entry) => entry.province === province)
      .map((entry) => entry.district)
  );
}

export function getThaiSubDistrictOptions(province: string, district: string) {
  return uniqueSorted(
    getThaiAddressEntries()
      .filter((entry) => entry.province === province && entry.district === district)
      .map((entry) => entry.subDistrict)
  );
}

export function getThaiPostalCodeOptions(province: string, district: string, subDistrict: string) {
  return uniqueSorted(
    getThaiAddressEntries()
      .filter((entry) => entry.province === province && entry.district === district && entry.subDistrict === subDistrict)
      .map((entry) => entry.postalCode)
  );
}

export function isValidThaiAddress(input: {
  province: string | null;
  district: string | null;
  subDistrict: string | null;
  postalCode: string | null;
}) {
  return getThaiAddressEntries().some(
    (entry) =>
      entry.province === input.province &&
      entry.district === input.district &&
      entry.subDistrict === input.subDistrict &&
      entry.postalCode === input.postalCode
  );
}
