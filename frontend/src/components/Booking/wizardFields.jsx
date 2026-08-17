import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FiCheckCircle, FiChevronDown, FiMap, FiPhone } from 'react-icons/fi';

export const inputClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500';
export const labelClass = 'mb-2 block text-[11px] font-black uppercase tracking-[0.12em] text-slate-600';

export const BANAADIR_DISTRICTS = [
  'Abdulaziz', 'Boondheere', 'Dayniile', 'Dharkenley', 'Garasbaaley', 'Heliwaa',
  'Hodan', 'Howlwadaag', 'Kaaraan', 'Kaxda', 'Shangaani', 'Shibis', 'Waaberi',
  'Wadajir', 'Wardhiigley', 'Xamar Jajab', 'Xamar Weyne', 'Yaqshiid',
];

export const districtKey = (value) => String(value || '')
  .toLowerCase()
  .replace(/\bdistrict\b/g, '')
  .replace(/[^a-z0-9]/g, '');

const DISTRICT_ALIASES = {
  hamarweyne: 'Xamar Weyne', hamarjajab: 'Xamar Jajab', hawlwadaag: 'Howlwadaag',
  waberi: 'Waaberi', karan: 'Kaaraan', karaan: 'Kaaraan', wardhiigleey: 'Wardhiigley',
  wardhigley: 'Wardhiigley', wardhigleey: 'Wardhiigley', banaadir: 'Hodan',
};

export const normalizeDistrictValue = (value, districtOptions = BANAADIR_DISTRICTS) => {
  const key = districtKey(value);
  const directMatch = districtOptions.find((district) => districtKey(district) === key);
  if (directMatch) return directMatch;
  const alias = DISTRICT_ALIASES[key];
  return districtOptions.find((district) => districtKey(district) === districtKey(alias)) || '';
};

export const RequiredLabel = ({ label, required = true }) => (
  <span className={labelClass}>
    {label}
    {required && <span className="ml-1 text-red-600">*</span>}
  </span>
);

export const Field = ({
  label, value, onChange, type = 'text', readOnly = false, disabled = false,
  min, max, error = '', inputMode, maxLength, icon, placeholder = '', required = false,
}) => (
  <label className="block">
    <RequiredLabel label={label} required={required} />
    <div className="relative">
      {icon && (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          {React.cloneElement(icon, { className: 'h-4 w-4' })}
        </span>
      )}
      <input
        type={type}
        value={value}
        min={min}
        max={max}
        inputMode={inputMode}
        maxLength={maxLength}
        readOnly={readOnly}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={`${inputClass} ${icon ? 'pl-10' : ''} ${error ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : ''}`}
      />
    </div>
    {error && <p className="mt-1.5 text-xs font-semibold text-red-600">{error}</p>}
  </label>
);

const phoneTailFromValue = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('25261')) return digits.slice(5, 12);
  if (digits.startsWith('061')) return digits.slice(3, 10);
  if (digits.startsWith('61')) return digits.slice(2, 9);
  return digits.slice(0, 7);
};

export const PhoneField = ({ value, onChange, error = '', disabled = false }) => (
  <label className="block">
    <RequiredLabel label="Phone Number" required />
    <div className="flex overflow-hidden rounded-xl border border-slate-300 bg-white focus-within:border-blue-600 focus-within:ring-4 focus-within:ring-blue-100">
      <span className="flex items-center gap-2 border-r border-slate-200 bg-slate-50 px-3 text-sm font-black text-slate-700">
        <FiPhone className="h-4 w-4 text-slate-400" />
        +252 61
      </span>
      <input
        type="tel"
        value={phoneTailFromValue(value)}
        inputMode="numeric"
        maxLength={7}
        disabled={disabled}
        placeholder="8318172"
        onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, 7))}
        className="min-w-0 flex-1 bg-white px-3 py-3 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
      />
    </div>
    {error && <p className="mt-1.5 text-xs font-semibold text-red-600">{error}</p>}
  </label>
);

export const DistrictSelect = ({ value, onChange, disabled = false, error = '', districts = BANAADIR_DISTRICTS }) => {
  const wrapperRef = useRef(null);
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const filteredDistricts = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return districts;
    return districts.filter((district) => district.toLowerCase().includes(term));
  }, [districts, query]);

  useEffect(() => {
    if (!isOpen) setQuery('');
  }, [isOpen, value]);

  useEffect(() => {
    if (activeIndex >= filteredDistricts.length) setActiveIndex(0);
  }, [activeIndex, filteredDistricts.length]);

  useEffect(() => {
    const closeOnOutsideClick = (event) => {
      if (!wrapperRef.current?.contains(event.target)) {
        setIsOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [value]);

  const selectDistrict = (district) => {
    onChange(district);
    setQuery('');
    setIsOpen(false);
    setActiveIndex(0);
  };

  const openDropdown = () => {
    if (disabled) return;
    const selectedIndex = districts.findIndex((district) => district === value);
    setQuery('');
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setIsOpen(true);
  };

  const clearDistrict = () => {
    onChange('');
    setQuery('');
    setActiveIndex(0);
    setIsOpen(true);
  };

  const handleKeyDown = (event) => {
    if (disabled) return;
    if (!isOpen && ['ArrowDown', 'Enter'].includes(event.key)) {
      event.preventDefault();
      setIsOpen(true);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => (filteredDistricts.length ? (current + 1) % filteredDistricts.length : 0));
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => (filteredDistricts.length ? (current - 1 + filteredDistricts.length) % filteredDistricts.length : 0));
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (filteredDistricts[activeIndex]) selectDistrict(filteredDistricts[activeIndex]);
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      setIsOpen(false);
      setQuery(value || '');
    }
  };

  return (
    <label className="block" ref={wrapperRef}>
      <RequiredLabel label="District" />
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-slate-400">
          <FiMap className="h-4 w-4" />
        </span>
        <input
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls="district-options"
          aria-autocomplete="list"
          value={isOpen ? query : value}
          disabled={disabled}
          placeholder="Select your district"
          autoComplete="off"
          onFocus={openDropdown}
          onChange={(event) => { setQuery(event.target.value); setIsOpen(true); setActiveIndex(0); }}
          onKeyDown={handleKeyDown}
          className={`${inputClass} pl-10 ${value && !disabled ? 'pr-20' : 'pr-10'} ${error ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : ''}`}
        />
        {value && !disabled && (
          <button
            type="button"
            onClick={clearDistrict}
            className="absolute right-10 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs font-black text-slate-500 transition hover:bg-slate-100 hover:text-blue-700"
            aria-label="Clear selected district"
          >
            Clear
          </button>
        )}
        <button
          type="button"
          disabled={disabled}
          onClick={() => (isOpen ? (setIsOpen(false), setQuery('')) : openDropdown())}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-blue-700 disabled:cursor-not-allowed disabled:text-slate-300"
          aria-label="Show Banaadir districts"
        >
          <FiChevronDown className={`h-4 w-4 transition ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && !disabled && (
          <div id="district-options" role="listbox" className="absolute z-30 mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-blue-100 bg-white p-1 shadow-xl">
            {filteredDistricts.length ? (
              filteredDistricts.map((district, index) => (
                <button
                  key={district}
                  type="button"
                  role="option"
                  aria-selected={value === district}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectDistrict(district)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-bold transition ${
                    index === activeIndex ? 'bg-blue-50 text-blue-800' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>{district}</span>
                  {value === district && <FiCheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />}
                </button>
              ))
            ) : (
              <div className="px-3 py-3 text-sm font-semibold text-slate-500">No district found.</div>
            )}
          </div>
        )}
      </div>
      {error && <p className="mt-1.5 text-xs font-semibold text-red-600">{error}</p>}
    </label>
  );
};

export const ReviewItem = ({ label, value }) => (
  <div className="rounded-xl border border-blue-100 bg-[#F8FAFC] p-3">
    <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">{label}</p>
    <p className="mt-1 text-sm font-bold text-slate-950">{value || '--'}</p>
  </div>
);
