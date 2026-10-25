import { Controller, useFormContext } from 'react-hook-form';
import { formatNaira, parseNaira } from '../../registration/services';
import { TextInput } from './ui';

/** Currency input bound to a numeric form field; displays ₦1,200,000. Works with any form schema. */
export default function MoneyInput({ name, id, placeholder = '₦0', invalid }: {
  name: string; id: string; placeholder?: string; invalid?: boolean;
}) {
  const { control } = useFormContext();
  return (
    <Controller control={control} name={name} render={({ field }) => (
      <TextInput
        id={id} inputMode="numeric" placeholder={placeholder} className="font-mono" invalid={invalid}
        value={formatNaira(Number(field.value) || 0)} ref={field.ref} onBlur={field.onBlur}
        onChange={(e) => field.onChange(parseNaira(e.target.value))}
      />
    )} />
  );
}
