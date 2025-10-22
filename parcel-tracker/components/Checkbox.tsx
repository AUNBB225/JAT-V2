interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}

export default function Checkbox({ checked, onChange, className = '' }: CheckboxProps) {
  return (
    <div
      className={`custom-checkbox ${checked ? 'checked' : ''} ${className}`}
      onClick={() => onChange(!checked)}
    >
      {checked && <i className="fas fa-check"></i>}
    </div>
  );
}
