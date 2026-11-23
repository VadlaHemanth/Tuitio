import type { Student } from '../types';

export function StudentName({ student }: { student?: Pick<Student, 'fullName' | 'nickname'> }) {
  return (
    <>
      {student?.nickname || student?.fullName || 'Student'}
      {student?.nickname && (
        <span className="block text-xs font-normal text-slate-600 dark:text-neutral-400">{student.fullName}</span>
      )}
    </>
  );
}
