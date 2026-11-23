-- 1. Update Aditya and Abhinay with nicknames and 2h duration
UPDATE students SET nickname = 'Adi', expected_duration_minutes = 120, preferred_arrival_time = '18:00', allocated_slot = '18:00–20:00', updated_at = '2026-11-23T20:00:00.000Z' WHERE id = 'stu-13f6c343556a';
UPDATE students SET nickname = 'Abi', expected_duration_minutes = 120, preferred_arrival_time = '18:00', allocated_slot = '18:00–20:00', updated_at = '2026-11-23T20:00:00.000Z' WHERE id = 'stu-ad9349f0354f';

-- 2. Insert new students
INSERT OR IGNORE INTO students (
  id, student_code, full_name, nickname, avatar_color,
  class_level, board, school_name, admission_date, date_of_birth,
  student_phone, parent_name, parent_phone, emergency_contact, address,
  subjects_json, strengths_json, weaknesses_json, academic_performance,
  preferred_arrival_time, allocated_slot, expected_duration_minutes,
  regular_days_json, fee_due_day, fee_override_json, credit_balance_paise,
  notes, learning_speed, priority, academic_goals, status, is_demo,
  created_at, updated_at
) VALUES (
  'stu-arjun-103', 'STU-103', 'Arjun', NULL, '#F59E0B',
  3, 'SSC', '', '2026-11-01', NULL,
  NULL, '', '', NULL, NULL,
  '[]', '[]', '[]', 75,
  '18:00', '18:00–20:00', 120,
  '[1,2,3,4,5,6]', 5, NULL, 0,
  '', 'steady', 'normal', '', 'active', 0,
  '2026-11-23T20:00:00.000Z', '2026-11-23T20:00:00.000Z'
);
INSERT OR IGNORE INTO students (
  id, student_code, full_name, nickname, avatar_color,
  class_level, board, school_name, admission_date, date_of_birth,
  student_phone, parent_name, parent_phone, emergency_contact, address,
  subjects_json, strengths_json, weaknesses_json, academic_performance,
  preferred_arrival_time, allocated_slot, expected_duration_minutes,
  regular_days_json, fee_due_day, fee_override_json, credit_balance_paise,
  notes, learning_speed, priority, academic_goals, status, is_demo,
  created_at, updated_at
) VALUES (
  'stu-akshita-104', 'STU-104', 'Akshita', NULL, '#EC4899',
  3, 'SSC', '', '2026-11-01', NULL,
  NULL, '', '', NULL, NULL,
  '[]', '[]', '[]', 75,
  '18:00', '18:00–20:00', 120,
  '[1,2,3,4,5,6]', 5, NULL, 0,
  '', 'steady', 'normal', '', 'active', 0,
  '2026-11-23T20:00:00.000Z', '2026-11-23T20:00:00.000Z'
);
INSERT OR IGNORE INTO students (
  id, student_code, full_name, nickname, avatar_color,
  class_level, board, school_name, admission_date, date_of_birth,
  student_phone, parent_name, parent_phone, emergency_contact, address,
  subjects_json, strengths_json, weaknesses_json, academic_performance,
  preferred_arrival_time, allocated_slot, expected_duration_minutes,
  regular_days_json, fee_due_day, fee_override_json, credit_balance_paise,
  notes, learning_speed, priority, academic_goals, status, is_demo,
  created_at, updated_at
) VALUES (
  'stu-sambashiva-105', 'STU-105', 'Sambashiva', NULL, '#8B5CF6',
  7, 'SSC', '', '2026-11-01', NULL,
  NULL, '', '', NULL, NULL,
  '[]', '[]', '[]', 75,
  '18:00', '18:00–20:00', 120,
  '[1,2,3,4,5,6]', 5, NULL, 0,
  '', 'steady', 'normal', '', 'active', 0,
  '2026-11-23T20:00:00.000Z', '2026-11-23T20:00:00.000Z'
);
INSERT OR IGNORE INTO students (
  id, student_code, full_name, nickname, avatar_color,
  class_level, board, school_name, admission_date, date_of_birth,
  student_phone, parent_name, parent_phone, emergency_contact, address,
  subjects_json, strengths_json, weaknesses_json, academic_performance,
  preferred_arrival_time, allocated_slot, expected_duration_minutes,
  regular_days_json, fee_due_day, fee_override_json, credit_balance_paise,
  notes, learning_speed, priority, academic_goals, status, is_demo,
  created_at, updated_at
) VALUES (
  'stu-ruthvik-ssc-106', 'STU-106', 'Ruthvik', NULL, '#06B6D4',
  4, 'SSC', '', '2026-11-01', NULL,
  NULL, '', '', NULL, NULL,
  '[]', '[]', '[]', 75,
  '18:00', '18:00–20:00', 120,
  '[1,2,3,4,5,6]', 5, NULL, 0,
  '', 'steady', 'normal', '', 'active', 0,
  '2026-11-23T20:00:00.000Z', '2026-11-23T20:00:00.000Z'
);
INSERT OR IGNORE INTO students (
  id, student_code, full_name, nickname, avatar_color,
  class_level, board, school_name, admission_date, date_of_birth,
  student_phone, parent_name, parent_phone, emergency_contact, address,
  subjects_json, strengths_json, weaknesses_json, academic_performance,
  preferred_arrival_time, allocated_slot, expected_duration_minutes,
  regular_days_json, fee_due_day, fee_override_json, credit_balance_paise,
  notes, learning_speed, priority, academic_goals, status, is_demo,
  created_at, updated_at
) VALUES (
  'stu-ruthvik-cbse-107', 'STU-107', 'Ruthvik', NULL, '#6366F1',
  9, 'CBSE', '', '2026-11-01', NULL,
  NULL, '', '', NULL, NULL,
  '[]', '[]', '[]', 75,
  '18:00', '18:00–20:00', 120,
  '[1,2,3,4,5,6]', 5, NULL, 0,
  '', 'steady', 'normal', '', 'active', 0,
  '2026-11-23T20:00:00.000Z', '2026-11-23T20:00:00.000Z'
);
INSERT OR IGNORE INTO students (
  id, student_code, full_name, nickname, avatar_color,
  class_level, board, school_name, admission_date, date_of_birth,
  student_phone, parent_name, parent_phone, emergency_contact, address,
  subjects_json, strengths_json, weaknesses_json, academic_performance,
  preferred_arrival_time, allocated_slot, expected_duration_minutes,
  regular_days_json, fee_due_day, fee_override_json, credit_balance_paise,
  notes, learning_speed, priority, academic_goals, status, is_demo,
  created_at, updated_at
) VALUES (
  'stu-karthik-108', 'STU-108', 'Karthik', NULL, '#F97316',
  7, 'CBSE', '', '2026-11-01', NULL,
  NULL, '', '', NULL, NULL,
  '[]', '[]', '[]', 75,
  '18:00', '18:00–20:00', 120,
  '[1,2,3,4,5,6]', 5, NULL, 0,
  '', 'steady', 'normal', '', 'active', 0,
  '2026-11-23T20:00:00.000Z', '2026-11-23T20:00:00.000Z'
);
INSERT OR IGNORE INTO students (
  id, student_code, full_name, nickname, avatar_color,
  class_level, board, school_name, admission_date, date_of_birth,
  student_phone, parent_name, parent_phone, emergency_contact, address,
  subjects_json, strengths_json, weaknesses_json, academic_performance,
  preferred_arrival_time, allocated_slot, expected_duration_minutes,
  regular_days_json, fee_due_day, fee_override_json, credit_balance_paise,
  notes, learning_speed, priority, academic_goals, status, is_demo,
  created_at, updated_at
) VALUES (
  'stu-abhinav-109', 'STU-109', 'Abhinav', NULL, '#14B8A6',
  4, 'SSC', '', '2026-11-01', NULL,
  NULL, '', '', NULL, NULL,
  '[]', '[]', '[]', 75,
  '18:00', '18:00–20:00', 120,
  '[1,2,3,4,5,6]', 5, NULL, 0,
  '', 'steady', 'normal', '', 'active', 0,
  '2026-11-23T20:00:00.000Z', '2026-11-23T20:00:00.000Z'
);
INSERT OR IGNORE INTO students (
  id, student_code, full_name, nickname, avatar_color,
  class_level, board, school_name, admission_date, date_of_birth,
  student_phone, parent_name, parent_phone, emergency_contact, address,
  subjects_json, strengths_json, weaknesses_json, academic_performance,
  preferred_arrival_time, allocated_slot, expected_duration_minutes,
  regular_days_json, fee_due_day, fee_override_json, credit_balance_paise,
  notes, learning_speed, priority, academic_goals, status, is_demo,
  created_at, updated_at
) VALUES (
  'stu-lohitaksh-110', 'STU-110', 'Lohitaksh', NULL, '#84CC16',
  4, 'CBSE', '', '2026-11-01', NULL,
  NULL, '', '', NULL, NULL,
  '[]', '[]', '[]', 75,
  '18:00', '18:00–20:00', 120,
  '[1,2,3,4,5,6]', 5, NULL, 0,
  '', 'steady', 'normal', '', 'active', 0,
  '2026-11-23T20:00:00.000Z', '2026-11-23T20:00:00.000Z'
);
INSERT OR IGNORE INTO students (
  id, student_code, full_name, nickname, avatar_color,
  class_level, board, school_name, admission_date, date_of_birth,
  student_phone, parent_name, parent_phone, emergency_contact, address,
  subjects_json, strengths_json, weaknesses_json, academic_performance,
  preferred_arrival_time, allocated_slot, expected_duration_minutes,
  regular_days_json, fee_due_day, fee_override_json, credit_balance_paise,
  notes, learning_speed, priority, academic_goals, status, is_demo,
  created_at, updated_at
) VALUES (
  'stu-likhith-111', 'STU-111', 'Likhith Sai', NULL, '#EAB308',
  9, 'CBSE', '', '2026-11-04', NULL,
  NULL, '', '', NULL, NULL,
  '[]', '[]', '[]', 75,
  '18:00', '18:00–20:00', 120,
  '[1,2,3,4,5,6]', 5, NULL, 0,
  '', 'steady', 'normal', '', 'active', 0,
  '2026-11-23T20:00:00.000Z', '2026-11-23T20:00:00.000Z'
);
INSERT OR IGNORE INTO students (
  id, student_code, full_name, nickname, avatar_color,
  class_level, board, school_name, admission_date, date_of_birth,
  student_phone, parent_name, parent_phone, emergency_contact, address,
  subjects_json, strengths_json, weaknesses_json, academic_performance,
  preferred_arrival_time, allocated_slot, expected_duration_minutes,
  regular_days_json, fee_due_day, fee_override_json, credit_balance_paise,
  notes, learning_speed, priority, academic_goals, status, is_demo,
  created_at, updated_at
) VALUES (
  'stu-lucky-112', 'STU-112', 'Lucky', NULL, '#A855F7',
  5, 'SSC', '', '2026-11-19', NULL,
  NULL, '', '', NULL, NULL,
  '[]', '[]', '[]', 75,
  '18:00', '18:00–20:00', 120,
  '[1,2,3,4,5,6]', 5, NULL, 0,
  '', 'steady', 'normal', '', 'active', 0,
  '2026-11-23T20:00:00.000Z', '2026-11-23T20:00:00.000Z'
);
INSERT OR IGNORE INTO students (
  id, student_code, full_name, nickname, avatar_color,
  class_level, board, school_name, admission_date, date_of_birth,
  student_phone, parent_name, parent_phone, emergency_contact, address,
  subjects_json, strengths_json, weaknesses_json, academic_performance,
  preferred_arrival_time, allocated_slot, expected_duration_minutes,
  regular_days_json, fee_due_day, fee_override_json, credit_balance_paise,
  notes, learning_speed, priority, academic_goals, status, is_demo,
  created_at, updated_at
) VALUES (
  'stu-ishika-113', 'STU-113', 'Ishika', 'Pandu', '#F43F5E',
  4, 'SSC', '', '2026-11-19', NULL,
  NULL, '', '', NULL, NULL,
  '[]', '[]', '[]', 75,
  '18:00', '18:00–20:00', 120,
  '[1,2,3,4,5,6]', 5, NULL, 0,
  '', 'steady', 'normal', '', 'active', 0,
  '2026-11-23T20:00:00.000Z', '2026-11-23T20:00:00.000Z'
);

-- 3. Insert Attendance records
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-f6c343556a-20261103', 'stu-13f6c343556a', '2026-11-03', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-f6c343556a-20261104', 'stu-13f6c343556a', '2026-11-04', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-f6c343556a-20261105', 'stu-13f6c343556a', '2026-11-05', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-f6c343556a-20261106', 'stu-13f6c343556a', '2026-11-06', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-f6c343556a-20261110', 'stu-13f6c343556a', '2026-11-10', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-f6c343556a-20261111', 'stu-13f6c343556a', '2026-11-11', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-f6c343556a-20261112', 'stu-13f6c343556a', '2026-11-12', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-f6c343556a-20261113', 'stu-13f6c343556a', '2026-11-13', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-f6c343556a-20261116', 'stu-13f6c343556a', '2026-11-16', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-f6c343556a-20261117', 'stu-13f6c343556a', '2026-11-17', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-f6c343556a-20261118', 'stu-13f6c343556a', '2026-11-18', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-f6c343556a-20261119', 'stu-13f6c343556a', '2026-11-19', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-f6c343556a-20261120', 'stu-13f6c343556a', '2026-11-20', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-f6c343556a-20261121', 'stu-13f6c343556a', '2026-11-21', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-f6c343556a-20261123', 'stu-13f6c343556a', '2026-11-23', 'absent', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-9349f0354f-20261103', 'stu-ad9349f0354f', '2026-11-03', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-9349f0354f-20261104', 'stu-ad9349f0354f', '2026-11-04', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-9349f0354f-20261105', 'stu-ad9349f0354f', '2026-11-05', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-9349f0354f-20261106', 'stu-ad9349f0354f', '2026-11-06', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-9349f0354f-20261110', 'stu-ad9349f0354f', '2026-11-10', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-9349f0354f-20261111', 'stu-ad9349f0354f', '2026-11-11', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-9349f0354f-20261112', 'stu-ad9349f0354f', '2026-11-12', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-9349f0354f-20261113', 'stu-ad9349f0354f', '2026-11-13', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-9349f0354f-20261116', 'stu-ad9349f0354f', '2026-11-16', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-9349f0354f-20261117', 'stu-ad9349f0354f', '2026-11-17', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-9349f0354f-20261118', 'stu-ad9349f0354f', '2026-11-18', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-9349f0354f-20261119', 'stu-ad9349f0354f', '2026-11-19', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-9349f0354f-20261120', 'stu-ad9349f0354f', '2026-11-20', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-9349f0354f-20261121', 'stu-ad9349f0354f', '2026-11-21', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-9349f0354f-20261123', 'stu-ad9349f0354f', '2026-11-23', 'absent', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att--arjun-103-20261103', 'stu-arjun-103', '2026-11-03', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att--arjun-103-20261104', 'stu-arjun-103', '2026-11-04', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att--arjun-103-20261105', 'stu-arjun-103', '2026-11-05', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att--arjun-103-20261106', 'stu-arjun-103', '2026-11-06', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att--arjun-103-20261110', 'stu-arjun-103', '2026-11-10', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att--arjun-103-20261111', 'stu-arjun-103', '2026-11-11', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att--arjun-103-20261112', 'stu-arjun-103', '2026-11-12', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att--arjun-103-20261113', 'stu-arjun-103', '2026-11-13', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att--arjun-103-20261116', 'stu-arjun-103', '2026-11-16', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att--arjun-103-20261117', 'stu-arjun-103', '2026-11-17', 'absent', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att--arjun-103-20261118', 'stu-arjun-103', '2026-11-18', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att--arjun-103-20261119', 'stu-arjun-103', '2026-11-19', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att--arjun-103-20261120', 'stu-arjun-103', '2026-11-20', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att--arjun-103-20261121', 'stu-arjun-103', '2026-11-21', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att--arjun-103-20261123', 'stu-arjun-103', '2026-11-23', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-kshita-104-20261103', 'stu-akshita-104', '2026-11-03', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-kshita-104-20261104', 'stu-akshita-104', '2026-11-04', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-kshita-104-20261105', 'stu-akshita-104', '2026-11-05', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-kshita-104-20261106', 'stu-akshita-104', '2026-11-06', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-kshita-104-20261110', 'stu-akshita-104', '2026-11-10', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-kshita-104-20261111', 'stu-akshita-104', '2026-11-11', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-kshita-104-20261112', 'stu-akshita-104', '2026-11-12', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-kshita-104-20261113', 'stu-akshita-104', '2026-11-13', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-kshita-104-20261116', 'stu-akshita-104', '2026-11-16', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-kshita-104-20261117', 'stu-akshita-104', '2026-11-17', 'absent', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-kshita-104-20261118', 'stu-akshita-104', '2026-11-18', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-kshita-104-20261119', 'stu-akshita-104', '2026-11-19', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-kshita-104-20261120', 'stu-akshita-104', '2026-11-20', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-kshita-104-20261121', 'stu-akshita-104', '2026-11-21', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-kshita-104-20261123', 'stu-akshita-104', '2026-11-23', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-ashiva-105-20261103', 'stu-sambashiva-105', '2026-11-03', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-ashiva-105-20261104', 'stu-sambashiva-105', '2026-11-04', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-ashiva-105-20261105', 'stu-sambashiva-105', '2026-11-05', 'absent', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-ashiva-105-20261106', 'stu-sambashiva-105', '2026-11-06', 'absent', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-ashiva-105-20261110', 'stu-sambashiva-105', '2026-11-10', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-ashiva-105-20261111', 'stu-sambashiva-105', '2026-11-11', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-ashiva-105-20261112', 'stu-sambashiva-105', '2026-11-12', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-ashiva-105-20261113', 'stu-sambashiva-105', '2026-11-13', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-ashiva-105-20261116', 'stu-sambashiva-105', '2026-11-16', 'absent', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-ashiva-105-20261117', 'stu-sambashiva-105', '2026-11-17', 'absent', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-ashiva-105-20261118', 'stu-sambashiva-105', '2026-11-18', 'absent', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-ashiva-105-20261119', 'stu-sambashiva-105', '2026-11-19', 'absent', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-ashiva-105-20261120', 'stu-sambashiva-105', '2026-11-20', 'absent', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-ashiva-105-20261121', 'stu-sambashiva-105', '2026-11-21', 'absent', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-ashiva-105-20261123', 'stu-sambashiva-105', '2026-11-23', 'absent', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-ik-ssc-106-20261103', 'stu-ruthvik-ssc-106', '2026-11-03', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-ik-ssc-106-20261104', 'stu-ruthvik-ssc-106', '2026-11-04', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-ik-ssc-106-20261105', 'stu-ruthvik-ssc-106', '2026-11-05', 'absent', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-ik-ssc-106-20261106', 'stu-ruthvik-ssc-106', '2026-11-06', 'absent', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-ik-ssc-106-20261110', 'stu-ruthvik-ssc-106', '2026-11-10', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-ik-ssc-106-20261111', 'stu-ruthvik-ssc-106', '2026-11-11', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-ik-ssc-106-20261112', 'stu-ruthvik-ssc-106', '2026-11-12', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-ik-ssc-106-20261113', 'stu-ruthvik-ssc-106', '2026-11-13', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-ik-ssc-106-20261116', 'stu-ruthvik-ssc-106', '2026-11-16', 'absent', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-ik-ssc-106-20261117', 'stu-ruthvik-ssc-106', '2026-11-17', 'absent', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-ik-ssc-106-20261118', 'stu-ruthvik-ssc-106', '2026-11-18', 'absent', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-ik-ssc-106-20261119', 'stu-ruthvik-ssc-106', '2026-11-19', 'absent', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-ik-ssc-106-20261120', 'stu-ruthvik-ssc-106', '2026-11-20', 'absent', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-ik-ssc-106-20261121', 'stu-ruthvik-ssc-106', '2026-11-21', 'absent', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-ik-ssc-106-20261123', 'stu-ruthvik-ssc-106', '2026-11-23', 'absent', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-k-cbse-107-20261103', 'stu-ruthvik-cbse-107', '2026-11-03', 'absent', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-k-cbse-107-20261104', 'stu-ruthvik-cbse-107', '2026-11-04', 'absent', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-k-cbse-107-20261105', 'stu-ruthvik-cbse-107', '2026-11-05', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-k-cbse-107-20261106', 'stu-ruthvik-cbse-107', '2026-11-06', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-k-cbse-107-20261110', 'stu-ruthvik-cbse-107', '2026-11-10', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-k-cbse-107-20261111', 'stu-ruthvik-cbse-107', '2026-11-11', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-k-cbse-107-20261112', 'stu-ruthvik-cbse-107', '2026-11-12', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-k-cbse-107-20261113', 'stu-ruthvik-cbse-107', '2026-11-13', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-k-cbse-107-20261116', 'stu-ruthvik-cbse-107', '2026-11-16', 'absent', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-k-cbse-107-20261117', 'stu-ruthvik-cbse-107', '2026-11-17', 'absent', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-k-cbse-107-20261118', 'stu-ruthvik-cbse-107', '2026-11-18', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-k-cbse-107-20261119', 'stu-ruthvik-cbse-107', '2026-11-19', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-k-cbse-107-20261120', 'stu-ruthvik-cbse-107', '2026-11-20', 'absent', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-k-cbse-107-20261121', 'stu-ruthvik-cbse-107', '2026-11-21', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-k-cbse-107-20261123', 'stu-ruthvik-cbse-107', '2026-11-23', 'absent', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-arthik-108-20261103', 'stu-karthik-108', '2026-11-03', 'absent', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-arthik-108-20261104', 'stu-karthik-108', '2026-11-04', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-arthik-108-20261105', 'stu-karthik-108', '2026-11-05', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-arthik-108-20261106', 'stu-karthik-108', '2026-11-06', 'absent', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-arthik-108-20261110', 'stu-karthik-108', '2026-11-10', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-arthik-108-20261111', 'stu-karthik-108', '2026-11-11', 'absent', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-arthik-108-20261112', 'stu-karthik-108', '2026-11-12', 'absent', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-arthik-108-20261113', 'stu-karthik-108', '2026-11-13', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-arthik-108-20261116', 'stu-karthik-108', '2026-11-16', 'absent', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-arthik-108-20261117', 'stu-karthik-108', '2026-11-17', 'absent', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-arthik-108-20261118', 'stu-karthik-108', '2026-11-18', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-arthik-108-20261119', 'stu-karthik-108', '2026-11-19', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-arthik-108-20261120', 'stu-karthik-108', '2026-11-20', 'absent', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-arthik-108-20261121', 'stu-karthik-108', '2026-11-21', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-arthik-108-20261123', 'stu-karthik-108', '2026-11-23', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-bhinav-109-20261103', 'stu-abhinav-109', '2026-11-03', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-bhinav-109-20261104', 'stu-abhinav-109', '2026-11-04', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-bhinav-109-20261105', 'stu-abhinav-109', '2026-11-05', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-bhinav-109-20261106', 'stu-abhinav-109', '2026-11-06', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-bhinav-109-20261110', 'stu-abhinav-109', '2026-11-10', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-bhinav-109-20261111', 'stu-abhinav-109', '2026-11-11', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-bhinav-109-20261112', 'stu-abhinav-109', '2026-11-12', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-bhinav-109-20261113', 'stu-abhinav-109', '2026-11-13', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-bhinav-109-20261116', 'stu-abhinav-109', '2026-11-16', 'absent', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-bhinav-109-20261117', 'stu-abhinav-109', '2026-11-17', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-bhinav-109-20261118', 'stu-abhinav-109', '2026-11-18', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-bhinav-109-20261119', 'stu-abhinav-109', '2026-11-19', 'absent', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-bhinav-109-20261120', 'stu-abhinav-109', '2026-11-20', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-bhinav-109-20261121', 'stu-abhinav-109', '2026-11-21', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-bhinav-109-20261123', 'stu-abhinav-109', '2026-11-23', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-itaksh-110-20261103', 'stu-lohitaksh-110', '2026-11-03', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-itaksh-110-20261104', 'stu-lohitaksh-110', '2026-11-04', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-itaksh-110-20261105', 'stu-lohitaksh-110', '2026-11-05', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-itaksh-110-20261106', 'stu-lohitaksh-110', '2026-11-06', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-itaksh-110-20261110', 'stu-lohitaksh-110', '2026-11-10', 'absent', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-itaksh-110-20261111', 'stu-lohitaksh-110', '2026-11-11', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-itaksh-110-20261112', 'stu-lohitaksh-110', '2026-11-12', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-itaksh-110-20261113', 'stu-lohitaksh-110', '2026-11-13', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-itaksh-110-20261116', 'stu-lohitaksh-110', '2026-11-16', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-itaksh-110-20261117', 'stu-lohitaksh-110', '2026-11-17', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-itaksh-110-20261118', 'stu-lohitaksh-110', '2026-11-18', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-itaksh-110-20261119', 'stu-lohitaksh-110', '2026-11-19', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-itaksh-110-20261120', 'stu-lohitaksh-110', '2026-11-20', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-itaksh-110-20261121', 'stu-lohitaksh-110', '2026-11-21', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-itaksh-110-20261123', 'stu-lohitaksh-110', '2026-11-23', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-ikhith-111-20261104', 'stu-likhith-111', '2026-11-04', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-ikhith-111-20261105', 'stu-likhith-111', '2026-11-05', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-ikhith-111-20261106', 'stu-likhith-111', '2026-11-06', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-ikhith-111-20261110', 'stu-likhith-111', '2026-11-10', 'absent', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-ikhith-111-20261111', 'stu-likhith-111', '2026-11-11', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-ikhith-111-20261112', 'stu-likhith-111', '2026-11-12', 'absent', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-ikhith-111-20261113', 'stu-likhith-111', '2026-11-13', 'absent', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-ikhith-111-20261116', 'stu-likhith-111', '2026-11-16', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-ikhith-111-20261117', 'stu-likhith-111', '2026-11-17', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-ikhith-111-20261118', 'stu-likhith-111', '2026-11-18', 'absent', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-ikhith-111-20261119', 'stu-likhith-111', '2026-11-19', 'absent', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-ikhith-111-20261120', 'stu-likhith-111', '2026-11-20', 'absent', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-ikhith-111-20261121', 'stu-likhith-111', '2026-11-21', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-ikhith-111-20261123', 'stu-likhith-111', '2026-11-23', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att--lucky-112-20261119', 'stu-lucky-112', '2026-11-19', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att--lucky-112-20261120', 'stu-lucky-112', '2026-11-20', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att--lucky-112-20261121', 'stu-lucky-112', '2026-11-21', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att--lucky-112-20261123', 'stu-lucky-112', '2026-11-23', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-ishika-113-20261119', 'stu-ishika-113', '2026-11-19', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-ishika-113-20261120', 'stu-ishika-113', '2026-11-20', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-ishika-113-20261121', 'stu-ishika-113', '2026-11-21', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');
INSERT OR IGNORE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('att-ishika-113-20261123', 'stu-ishika-113', '2026-11-23', 'present', NULL, NULL, '', 0, '2026-11-23T20:00:00.000Z');