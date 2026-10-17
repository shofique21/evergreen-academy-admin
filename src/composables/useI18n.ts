import { ref, computed } from 'vue';

export type Locale = 'en' | 'bn';

const currentLocale = ref<Locale>((localStorage.getItem('preferred_locale') as Locale) || 'en');

const translations: Record<Locale, Record<string, string>> = {
  en: {
    dashboard: 'Dashboard',
    students: 'Students',
    teachers: 'Teachers',
    academics: 'Academics',
    attendance: 'Attendance',
    timetable: 'Timetable',
    exams: 'Examinations',
    finance: 'Finance & Fees',
    communications: 'Communications',
    notices: 'Notice Board',
    profile: 'Profile',
    settings: 'Settings',
    logout: 'Log Out',
    save: 'Save Changes',
    cancel: 'Cancel',
    search: 'Search...',
    status_active: 'Active',
    status_inactive: 'Inactive',
    status_paid: 'Paid',
    status_unpaid: 'Unpaid',
    keyboard_hint: 'Press Enter to submit, Escape to cancel',
  },
  bn: {
    dashboard: 'ড্যাশবোর্ড',
    students: 'শিক্ষার্থীবৃন্দ',
    teachers: 'শিক্ষকমণ্ডলী',
    academics: 'একাডেমিক কাঠামো',
    attendance: 'উপস্থিতি',
    timetable: 'রুটিন ও সময়সূচী',
    exams: 'পরীক্ষা ও ফলাফল',
    finance: 'হিসাব ও ফি',
    communications: 'যোগাযোগ ও নোটিশ',
    notices: 'নোটিশ বোর্ড',
    profile: 'প্রোফাইল',
    settings: 'সেটিংস',
    logout: 'লগআউট',
    save: 'সংরক্ষণ করুন',
    cancel: 'বাতিল',
    search: 'অনুসন্ধান করুন...',
    status_active: 'সক্রিয়',
    status_inactive: 'নিষ্ক্রিয়',
    status_paid: 'পরিশোধিত',
    status_unpaid: 'অপরিশোধিত',
    keyboard_hint: 'জমা দিতে Enter চাপুন, বাতিল করতে Escape চাপুন',
  },
};

export function useI18n() {
  const t = (key: string): string => {
    return translations[currentLocale.value]?.[key] || translations.en[key] || key;
  };

  const setLocale = (locale: Locale) => {
    currentLocale.value = locale;
    localStorage.setItem('preferred_locale', locale);
    document.documentElement.lang = locale;
  };

  const isBangla = computed(() => currentLocale.value === 'bn');

  const toggleLocale = () => {
    setLocale(currentLocale.value === 'en' ? 'bn' : 'en');
  };

  return {
    locale: currentLocale,
    t,
    setLocale,
    toggleLocale,
    isBangla,
  };
}
