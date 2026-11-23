import os
import json

students = [
    # id, code, name, nickname, class_level, board, color, adm_date
    ("stu-arjun-103", "STU-103", "Arjun", None, 3, "SSC", "#F59E0B", "2026-11-01"),
    ("stu-akshita-104", "STU-104", "Akshita", None, 3, "SSC", "#EC4899", "2026-11-01"),
    ("stu-sambashiva-105", "STU-105", "Sambashiva", None, 7, "SSC", "#8B5CF6", "2026-11-01"),
    ("stu-ruthvik-ssc-106", "STU-106", "Ruthvik", None, 4, "SSC", "#06B6D4", "2026-11-01"),
    ("stu-ruthvik-cbse-107", "STU-107", "Ruthvik", None, 9, "CBSE", "#6366F1", "2026-11-01"),
    ("stu-karthik-108", "STU-108", "Karthik", None, 7, "CBSE", "#F97316", "2026-11-01"),
    ("stu-abhinav-109", "STU-109", "Abhinav", None, 4, "SSC", "#14B8A6", "2026-11-01"),
    ("stu-lohitaksh-110", "STU-110", "Lohitaksh", None, 4, "CBSE", "#84CC16", "2026-11-01"),
    ("stu-likhith-111", "STU-111", "Likhith Sai", None, 9, "CBSE", "#EAB308", "2026-11-04"),
    ("stu-lucky-112", "STU-112", "Lucky", None, 5, "SSC", "#A855F7", "2026-11-20"),
    ("stu-ishika-113", "STU-113", "Ishika", "Pandu", 4, "SSC", "#F43F5E", "2026-11-20"),
]

dates = [
    '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06',
    '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13',
    '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-23'
]

# Attendance map: student_id -> list of status ('P' or 'A' or None) matching dates
# Aditya
aditya_att = ['P','P','P','P', 'P','P','P','P', 'P','P','P','P','P','P', 'A']
# Abhinay
abhinay_att = ['P','P','P','P', 'P','P','P','P', 'P','P','P','P','P','P', 'A']
# Arjun
arjun_att = ['P','P','P','P', 'P','P','P','P', 'P','A','P','P','P','P', 'P']
# Akshita
akshita_att = ['P','P','P','P', 'P','P','P','P', 'P','A','P','P','P','P', 'P']
# Sambashiva
sambashiva_att = ['P','P','A','A', 'P','P','P','P', 'A','A','A','A','A','A', 'A']
# Ruthvik (SSC 4, Dhruthik)
ruthvik_ssc_att = ['P','P','A','A', 'P','P','P','P', 'A','A','A','A','A','A', 'A']
# Ruthvik (CBSE 9)
ruthvik_cbse_att = ['A','A','P','P', 'P','P','P','P', 'A','A','P','P','A','P', 'P']
# Karthik
karthik_att = ['A','P','P','A', 'P','A','A','P', 'A','A','P','P','A','P', 'P']
# Abhinav
abhinav_att = ['P','P','P','P', 'P','P','P','P', 'A','P','P','A','P','P', 'P']
# Lohitaksh
lohitaksh_att = ['P','P','P','P', 'A','P','P','P', 'P','P','P','P','P','P', 'P']
# Likhith Sai (joined Nov 4)
likhith_att = ['A','P','P','P', 'A','P','A','P', 'P','P','A','A','A','P', 'P']
# Lucky (joined Nov 20)
lucky_att = [None,None,None,None, None,None,None,None, None,None,None,None, 'P','P', 'P']
# Ishika / Pandu (joined Nov 20)
ishika_att = [None,None,None,None, None,None,None,None, None,None,None,None, 'P','P', 'P']

attendance_data = {
    "stu-13f6c343556a": aditya_att,
    "stu-ad9349f0354f": abhinay_att,
    "stu-arjun-103": arjun_att,
    "stu-akshita-104": akshita_att,
    "stu-sambashiva-105": sambashiva_att,
    "stu-ruthvik-ssc-106": ruthvik_ssc_att,
    "stu-ruthvik-cbse-107": ruthvik_cbse_att,
    "stu-karthik-108": karthik_att,
    "stu-abhinav-109": abhinav_att,
    "stu-lohitaksh-110": lohitaksh_att,
    "stu-likhith-111": likhith_att,
    "stu-lucky-112": lucky_att,
    "stu-ishika-113": ishika_att,
}

lines = []
now = "2026-11-23T20:00:00.000Z"

# 1. Update existing Aditya and Abhinay
lines.append("-- 1. Update Aditya and Abhinay with nicknames and 2h duration")
lines.append("UPDATE students SET nickname = 'Adi', expected_duration_minutes = 120, preferred_arrival_time = '18:00', allocated_slot = '18:00–20:00', updated_at = '{0}' WHERE id = 'stu-13f6c343556a';".format(now))
lines.append("UPDATE students SET nickname = 'Abi', expected_duration_minutes = 120, preferred_arrival_time = '18:00', allocated_slot = '18:00–20:00', updated_at = '{0}' WHERE id = 'stu-ad9349f0354f';".format(now))

# 2. Insert new students
lines.append("\n-- 2. Insert new students")
for sid, code, name, nick, class_level, board, color, adm in students:
    nick_val = f"'{nick}'" if nick else "NULL"
    lines.append(f"""INSERT OR REPLACE INTO students (
  id, student_code, full_name, nickname, avatar_color,
  class_level, board, school_name, admission_date, date_of_birth,
  student_phone, parent_name, parent_phone, emergency_contact, address,
  subjects_json, strengths_json, weaknesses_json, academic_performance,
  preferred_arrival_time, allocated_slot, expected_duration_minutes,
  regular_days_json, fee_due_day, fee_override_json, credit_balance_paise,
  notes, learning_speed, priority, academic_goals, status, is_demo,
  created_at, updated_at
) VALUES (
  '{sid}', '{code}', '{name}', {nick_val}, '{color}',
  {class_level}, '{board}', '', '{adm}', NULL,
  NULL, 'Parent', '', NULL, NULL,
  '["All Subjects"]', '[]', '[]', 75,
  '18:00', '18:00–20:00', 120,
  '[1,2,3,4,5,6]', 5, NULL, 0,
  '', 'steady', 'normal', '', 'active', 0,
  '{now}', '{now}'
);""")

# 3. Attendance
lines.append("\n-- 3. Insert Attendance records")
att_counter = 1
for sid, att_list in attendance_data.items():
    for d, status_char in zip(dates, att_list):
        if not status_char:
            continue
        att_id = f"att-{sid[-10:]}-{d.replace('-', '')}"
        status = "present" if status_char == "P" else "absent"
        arr = "'18:00'" if status == "present" else "NULL"
        dep = "'20:00'" if status == "present" else "NULL"
        lines.append(f"INSERT OR REPLACE INTO attendance (id, student_id, date, status, actual_arrival_time, departure_time, note, is_demo, updated_at) VALUES ('{att_id}', '{sid}', '{d}', '{status}', {arr}, {dep}, '', 0, '{now}');")

os.makedirs("scripts", exist_ok=True)
with open("scripts/import.sql", "w", encoding="utf-8") as f:
    f.write("\n".join(lines))

print(f"Generated scripts/import.sql with {len(lines)} lines")
