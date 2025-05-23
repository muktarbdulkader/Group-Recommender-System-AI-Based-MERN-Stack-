import sqlite3
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE = os.path.join(BASE_DIR, 'database.db')

SAMPLE_DATA = [
    {'id': 1, 'skills': ['Python', 'Flask'], 'availability': ['Mon 10-12', 'Wed 14-16'], 'name': 'Amir Ibrahim', 'email': 'amir@example.com'},
    {'id': 2, 'skills': ['Django', 'database'], 'availability': ['Tue 10-12', 'Thu 14-16'], 'name': 'Ammar Jemil', 'email': 'ammar@example.com'},
    {'id': 3, 'skills': ['ML', 'data analysis'], 'availability': ['Mon 14-16', 'Fri 10-12'], 'name': 'Luil Tesema', 'email': 'luil@example.com'},
    {'id': 4, 'skills': ['UX', 'UI'], 'availability': ['Wed 10-12', 'Thu 10-12'], 'name': 'Muktar Abdulkader', 'email': 'muktar@example.com'},
    {'id': 5, 'skills': ['management', 'docs'], 'availability': ['Mon 10-12', 'Tue 14-16'], 'name': 'Muaz Kedir', 'email': 'muaz@example.com'},
    {'id': 6, 'skills': ['Python', 'backend'], 'availability': ['Fri 14-16', 'Wed 14-16'], 'name': 'Abider Mifta', 'email': 'abider@example.com'},
]

def get_db_connection() -> sqlite3.Connection:
    os.makedirs(os.path.dirname(DATABASE), exist_ok=True)
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY,
            email TEXT UNIQUE,
            name TEXT,
            skills TEXT,
            interests TEXT,
            availability TEXT
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS groups (
            id INTEGER PRIMARY KEY,
            name TEXT,
            members TEXT,
            matching_skills TEXT,
            study_time TEXT,
            status TEXT
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS feedback (
            id INTEGER PRIMARY KEY,
            group_id INTEGER,
            user_id INTEGER,
            content TEXT,
            rating INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (group_id) REFERENCES groups(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS schedules (
            id INTEGER PRIMARY KEY,
            group_id INTEGER,
            date TEXT,
            start_time TEXT,
            end_time TEXT,
            location TEXT,
            agenda TEXT,
            FOREIGN KEY (group_id) REFERENCES groups(id)
        )
    ''')

    cursor.execute("PRAGMA table_info(groups)")
    columns = [col['name'] for col in cursor.fetchall()]
    if 'name' not in columns:
        cursor.execute('ALTER TABLE groups ADD COLUMN name TEXT')
    if 'members' not in columns:
        cursor.execute('ALTER TABLE groups ADD COLUMN members TEXT')
    
    for user in SAMPLE_DATA:
        cursor.execute(
            'INSERT OR IGNORE INTO users (id, email, name, skills, interests, availability) VALUES (?, ?, ?, ?, ?, ?)',
            (
                user['id'],
                user['email'],
                user['name'],
                ','.join(user['skills']),
                '',
                ','.join(user['availability'])
            )
        )
    
    sample_schedules = [
        {'group_id': 1, 'date': '2025-05-22', 'start_time': '10:00', 'end_time': '12:00', 'location': 'Room 101', 'agenda': 'Python Workshop'},
        {'group_id': 2, 'date': '2025-05-23', 'start_time': '14:00', 'end_time': '16:00', 'location': 'Room 102', 'agenda': 'Database Design'},
    ]
    for schedule in sample_schedules:
        cursor.execute(
            'INSERT OR IGNORE INTO schedules (group_id, date, start_time, end_time, location, agenda) VALUES (?, ?, ?, ?, ?, ?)',
            (
                schedule['group_id'],
                schedule['date'],
                schedule['start_time'],
                schedule['end_time'],
                schedule['location'],
                schedule['agenda']
            )
        )
    
    conn.commit()
    conn.close()

def get_user_by_email(email):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM users WHERE email = ?', (email,))
    user = cursor.fetchone()
    conn.close()
    return user

def save_user(email, name, skills='', interests='', availability='TBD'):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        'INSERT OR REPLACE INTO users (email, name, skills, interests, availability) VALUES (?, ?, ?, ?, ?)',
        (email, name, skills, interests, availability)
    )
    cursor.execute('SELECT id FROM users WHERE email = ?', (email,))
    user_id = cursor.fetchone()['id']
    conn.commit()
    conn.close()
    return user_id

def get_groups():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM groups')
    groups = [
        {
            'id': row['id'],
            'name': row['name'],
            'members': row['members'].split(',') if row['members'] else [],
            'matching_skills': row['matching_skills'].split(',') if row['matching_skills'] else [],
            'study_time': row['study_time'],
            'status': row['status'],
            'feedback': []
        }
        for row in cursor.fetchall()
    ]
    for group in groups:
        cursor.execute('SELECT id, content, rating, user_id, created_at FROM feedback WHERE group_id = ?', (group['id'],))
        group['feedback'] = [
            {
                'id': row['id'],
                'content': row['content'],
                'rating': row['rating'],
                'userId': row['user_id'],
                'created_at': row['created_at']
            }
            for row in cursor.fetchall()
        ]
    conn.close()
    return groups

def save_feedback(group_id, user_id, content, rating):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        'INSERT INTO feedback (group_id, user_id, content, rating) VALUES (?, ?, ?, ?)',
        (group_id, user_id, content, rating)
    )
    feedback_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return feedback_id

def get_skill_match_stats():
    conn = get_db_connection()
    cursor = conn.cursor()
    # Count unique users in groups.members
    cursor.execute('SELECT members FROM groups WHERE members IS NOT NULL')
    grouped_names = set()
    for row in cursor.fetchall():
        if row['members']:
            grouped_names.update(row['members'].split(','))
    grouped_count = len(grouped_names)
    # Total users
    cursor.execute('SELECT COUNT(DISTINCT id) as total FROM users')
    total = cursor.fetchone()['total']
    conn.close()
    return {'grouped': grouped_count, 'ungrouped': total - grouped_count}

def get_skill_distribution():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT skills FROM users')
    skills = [skill for row in cursor.fetchall() for skill in row['skills'].split(',') if row['skills']]
    skill_counts = {}
    for skill in skills:
        skill_counts[skill] = skill_counts.get(skill, 0) + 1
    conn.close()
    return [{'skill': k, 'count': v} for k, v in skill_counts.items()]