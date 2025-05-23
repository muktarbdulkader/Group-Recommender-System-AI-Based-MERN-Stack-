from flask import Flask, request, jsonify
from database import (
    init_db,
    get_db_connection,
    get_user_by_email,
    save_user,
    get_groups,
    save_feedback,
    get_skill_match_stats,
    get_skill_distribution,
)
from recommender import initialize_groups, match_student_to_group, get_existing_groups
import logging
import sqlite3

app = Flask(__name__)
logging.basicConfig(level=logging.DEBUG)

init_db()

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    if not email or not isinstance(email, str):
        app.logger.error("Login failed: Valid email is required")
        return jsonify({'error': 'Valid email is required'}), 400
    
    user = get_user_by_email(email)
    if not user:
        app.logger.error(f"Login failed: User not found for email {email}")
        return jsonify({'error': 'User not found'}), 404
    
    initialize_groups()
    existing_groups = get_existing_groups()

    profile = {
        'id': user['id'],
        'name': user['name'].strip(),
        'skills': [s.strip().lower() for s in user['skills'].split(',')] if user['skills'] else [],
        'availability': [a.strip() for a in user['availability'].split(',')] if user['availability'] else ['TBD'],
    }
    app.logger.debug(f"Login: Matching user {profile['name']} with skills {profile['skills']}")
    matched_group = match_student_to_group(profile, existing_groups)
    app.logger.debug(f"Login: Matched to group {matched_group.get('name', 'None')}")
    
    return jsonify({
        'user': {
            'id': user['id'],
            'email': user['email'],
            'name': user['name'].strip(),
            'role': 'student',
            'skills': profile['skills'],
            'availability': profile['availability'],
            'interests': [i.strip() for i in user['interests'].split(',')] if user['interests'] else []
        },
        'matched_group': matched_group
    })

@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    if not data:
        app.logger.error("Register failed: No JSON data provided")
        return jsonify({'error': 'No data provided'}), 400

    email = data.get('email')
    name = data.get('name')
    if not email or not name or not isinstance(email, str) or not isinstance(name, str):
        app.logger.error(f"Register failed: Email and name are required and must be strings (email: {email}, name: {name})")
        return jsonify({'error': 'Valid email and name are required'}), 400

    try:
        existing_user = get_user_by_email(email)
        if existing_user:
            app.logger.error(f"Register failed: User already exists for email {email}")
            return jsonify({'error': 'User already exists'}), 400
        
        # Save new user with empty skills/interests, default availability 'TBD'
        user_id = save_user(email, name.strip(), skills='', interests='', availability='TBD')
        if not user_id:
            app.logger.error(f"Register failed: Failed to create user for email {email}")
            return jsonify({'error': 'Failed to create user'}), 500
        
        # Clear groups to avoid conflicts
        conn = get_db_connection()
        with conn:
            conn.execute("DELETE FROM groups")
        conn.close()

        initialize_groups()
        existing_groups = get_existing_groups()
        user = get_user_by_email(email)
        profile = {
            'id': user['id'],
            'name': user['name'].strip(),
            'skills': [],
            'availability': ['TBD'],
        }
        matched_group = match_student_to_group(profile, existing_groups)

        return jsonify({
            'user': {
                'id': user['id'],
                'email': user['email'],
                'name': user['name'].strip(),
                'role': 'student',
                'skills': [],
                'interests': [],
                'availability': ['TBD'],
            },
            'matched_group': matched_group
        })
    except sqlite3.IntegrityError as e:
        app.logger.error(f"Register failed: Database integrity error: {str(e)}")
        return jsonify({'error': f'Registration failed: {str(e)}'}), 500
    except Exception as e:
        app.logger.error(f"Register failed: Unexpected error: {str(e)}")
        return jsonify({'error': f'Registration failed: {str(e)}'}), 500

@app.route('/api/profile', methods=['POST'])
def update_profile():
    data = request.get_json()
    app.logger.debug(f"Profile update data: {data}")
    user_id = data.get('id')
    email = data.get('email')

    if not email or not user_id or not isinstance(email, str):
        return jsonify({'error': 'Valid email and ID are required'}), 400

    skills = [s.strip().lower() for s in data.get('skills', []) if isinstance(s, str)]
    interests = [i.strip() for i in data.get('interests', []) if isinstance(i, str)]
    availability = [a.strip() for a in data.get('availability', ['TBD']) if isinstance(a, str)]

    try:
        # Update existing user - save_user should handle updates for existing email
        save_user(
            email=email,
            name=data.get('name', '').strip(),
            skills=','.join(skills),
            interests=','.join(interests),
            availability=','.join(availability) if availability else 'TBD'
        )

        # Clear groups to refresh after profile update
        conn = get_db_connection()
        with conn:
            conn.execute("DELETE FROM groups")
        conn.close()

        initialize_groups()
        existing_groups = get_existing_groups()
        user = get_user_by_email(email)
        profile = {
            'id': user['id'],
            'name': user['name'].strip(),
            'skills': skills,
            'availability': availability
        }
        matched_group = match_student_to_group(profile, existing_groups)

        return jsonify({
            'matched_group': matched_group,
            'message': 'Profile updated and groups reinitialized'
        })
    except Exception as e:
        app.logger.error(f"Profile update failed: {str(e)}")
        return jsonify({'error': f'Profile update failed: {str(e)}'}), 500

@app.route('/api/reinitialize-groups', methods=['POST'])
def reinitialize_groups_route():
    try:
        conn = get_db_connection()
        with conn:
            conn.execute("DELETE FROM groups")
        conn.close()
        initialize_groups()
        return jsonify({'message': 'Groups reinitialized'})
    except Exception as e:
        app.logger.error(f"Reinitialize groups failed: {str(e)}")
        return jsonify({'error': f'Reinitialize groups failed: {str(e)}'}), 500

@app.route('/api/groups', methods=['GET'])
def get_groups_route():
    try:
        groups = get_groups()
        app.logger.debug(f"Returning groups: {groups}")
        return jsonify({'groups': groups})
    except Exception as e:
        app.logger.error(f"Get groups failed: {str(e)}")
        return jsonify({'error': f'Get groups failed: {str(e)}'}), 500

@app.route('/api/feedback/<int:group_id>', methods=['POST'])
def submit_feedback(group_id):
    data = request.get_json()
    user_id = data.get('userId')
    content = data.get('feedback')
    rating = data.get('rating')

    if not user_id or not content or rating is None:
        return jsonify({'error': 'userId, feedback content, and rating are required'}), 400

    try:
        feedback_id = save_feedback(group_id, user_id, content, rating)
        return jsonify({'feedback': {'id': feedback_id, 'content': content, 'rating': rating, 'userId': user_id}})
    except Exception as e:
        app.logger.error(f"Submit feedback failed: {str(e)}")
        return jsonify({'error': f'Submit feedback failed: {str(e)}'}), 500

@app.route('/api/schedules', methods=['GET'])
def get_schedules():
    group_id = request.args.get('groupId')
    if not group_id:
        return jsonify({'error': 'groupId query parameter is required'}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM schedules WHERE group_id = ?', (group_id,))
        schedules = [
            {
                'id': row['id'],
                'groupId': row['group_id'],
                'date': row['date'],
                'startTime': row['start_time'],
                'endTime': row['end_time'],
                'location': row['location'],
                'agenda': row['agenda']
            }
            for row in cursor.fetchall()
        ]
        conn.close()
        return jsonify({'schedules': schedules})
    except Exception as e:
        app.logger.error(f"Get schedules failed: {str(e)}")
        return jsonify({'error': f'Get schedules failed: {str(e)}'}), 500

@app.route('/api/schedule', methods=['POST'])
def schedule_session():
    data = request.get_json()
    group_id = data.get('groupId')
    date = data.get('date')
    start_time = data.get('startTime')
    end_time = data.get('endTime')
    location = data.get('location', '')
    agenda = data.get('agenda', '')

    if not all([group_id, date, start_time, end_time]):
        return jsonify({'error': 'Missing required fields'}), 400

    try:
        conn = get_db_connection()
        with conn:
            conn.execute(
                'INSERT INTO schedules (group_id, date, start_time, end_time, location, agenda) VALUES (?, ?, ?, ?, ?, ?)',
                (group_id, date, start_time, end_time, location, agenda)
            )
        conn.close()
        return jsonify({'message': 'Schedule added successfully'}), 201
    except Exception as e:
        app.logger.error(f"Schedule session failed: {str(e)}")
        return jsonify({'error': f'Schedule session failed: {str(e)}'}), 500

@app.route('/api/skill-match-stats', methods=['GET'])
def skill_match_stats():
    try:
        stats = get_skill_match_stats()
        app.logger.debug(f"Skill match stats: {stats}")
        return jsonify(stats)
    except Exception as e:
        app.logger.error(f"Skill match stats failed: {str(e)}")
        return jsonify({'error': f'Skill match stats failed: {str(e)}'}), 500

@app.route('/api/skill-distribution', methods=['GET'])
def skill_distribution():
    try:
        skills = get_skill_distribution()
        app.logger.debug(f"Skill distribution: {skills}")
        return jsonify({'skills': skills})
    except Exception as e:
        app.logger.error(f"Skill distribution failed: {str(e)}")
        return jsonify({'error': f'Skill distribution failed: {str(e)}'}), 500

if __name__ == '__main__':
    app.run(debug=True)
