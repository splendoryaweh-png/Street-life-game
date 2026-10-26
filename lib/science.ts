/**
 * Science Skill Integration for Street Life:
 * Street Hustler Bio-Enhancement & Neuro-Chemistry Research
 * Powered by PubChem API (NCBI) for authentic biochemical compounds.
 */

export interface HustleCompound {
  cid: number;
  name: string;
  category: 'Neurotransmitter' | 'Energy Booster' | 'Endurance Metabolite' | 'Cognitive Enhancer';
  formula: string;
  molecularWeight: string;
  iupacName: string;
  smiles: string;
  gameEffect: string;
  provenance: string;
}

export const KNOWN_HUSTLE_COMPOUNDS: HustleCompound[] = [
  {
    cid: 2519,
    name: 'Caffeine',
    category: 'Cognitive Enhancer',
    formula: 'C8H10N4O2',
    molecularWeight: '194.19 g/mol',
    iupacName: '1,3,7-trimethylpurine-2,6-dione',
    smiles: 'CN1C=NC2=C1C(=O)N(C(=O)N2C)C',
    gameEffect: '+25% Tap Reaction Speed & Ad Energy Buffer',
    provenance: 'PubChem CID 2519 (NCBI Structure Records)',
  },
  {
    cid: 681,
    name: 'Dopamine',
    category: 'Neurotransmitter',
    formula: 'C8H11NO2',
    molecularWeight: '153.18 g/mol',
    iupacName: '4-(2-aminoethyl)benzene-1,2-diol',
    smiles: 'C1=CC(=C(C=C1CCN)O)O',
    gameEffect: '+50 Daily Streak Retention & Hustler Motivation',
    provenance: 'PubChem CID 681 (NCBI Neurobiology)',
  },
  {
    cid: 5862,
    name: 'Creatine',
    category: 'Endurance Metabolite',
    formula: 'C4H9N3O2',
    molecularWeight: '131.13 g/mol',
    iupacName: '2-[carbamimidoyl(methyl)amino]acetic acid',
    smiles: 'CN(CC(=O)O)C(=N)N',
    gameEffect: 'Cellular ATP Booster for Street Boxing stamina',
    provenance: 'PubChem CID 5862 (NCBI Biochemical Catalog)',
  },
  {
    cid: 1123,
    name: 'Taurine',
    category: 'Energy Booster',
    formula: 'C2H7NO3S',
    molecularWeight: '125.15 g/mol',
    iupacName: '2-aminoethanesulfonic acid',
    smiles: 'C(CS(=O)(=O)O)N',
    gameEffect: 'Electrolyte balance & Stress resistance in Street Race',
    provenance: 'PubChem CID 1123 (NCBI Bioactive Compound)',
  },
];

export async function fetchLiveCompoundProperty(compoundName: string): Promise<Partial<HustleCompound> | null> {
  try {
    const encoded = encodeURIComponent(compoundName.trim());
    const res = await fetch(
      `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encoded}/property/MolecularFormula,MolecularWeight,IUPACName,CanonicalSMILES/JSON`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const props = data.PropertyTable?.Properties?.[0];
    if (!props) return null;

    return {
      cid: props.CID,
      formula: props.MolecularFormula,
      molecularWeight: `${props.MolecularWeight} g/mol`,
      iupacName: props.IUPACName,
      smiles: props.CanonicalSMILES,
      provenance: `Live PubChem Query CID ${props.CID}`,
    };
  } catch (err) {
    console.warn('PubChem fetch skipped, using local certified data:', err);
    return null;
  }
}
