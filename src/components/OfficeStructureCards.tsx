import { Building2, GitBranch, Layers } from 'lucide-react';
import { Card } from './ui';

type Props = {
  departments: number;
  units: number;
  subunits: number;
};

const items = [
  { key: 'departments', label: 'Departments', icon: Building2, color: 'text-sky-600 bg-sky-50' },
  { key: 'units', label: 'Units', icon: Layers, color: 'text-violet-600 bg-violet-50' },
  { key: 'subunits', label: 'Subunits', icon: GitBranch, color: 'text-slate-600 bg-slate-100' },
] as const;

export default function OfficeStructureCards({ departments, units, subunits }: Props) {
  const counts = { departments, units, subunits };

  return (
    <div className="grid sm:grid-cols-3 gap-4">
      {items.map(({ key, label, icon: Icon, color }) => (
        <Card key={key} title={label}>
          <div className="flex items-center justify-between gap-3">
            <div className="text-3xl font-semibold text-slate-800">{counts[key]}</div>
            <div className={`rounded-lg p-2.5 ${color}`}>
              <Icon className="h-5 w-5" aria-hidden />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
