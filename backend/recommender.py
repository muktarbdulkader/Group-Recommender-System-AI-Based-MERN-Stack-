import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.cluster import KMeans
from collections import defaultdict
import random
import logging
import sqlite3
import uuid

from database import get_db_connection

logging.basicConfig(level=logging.DEBUG)

def get_existing_groups():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, members, matching_skills, study_time, status FROM groups WHERE status = 'active'")
    groups = [
        {
            'id': row['id'],
            'name': row['name'] or f"Group {row['id']}",
            'members': [m.strip() for m in row['members'].split(',')] if row['members'] else [],
            'matching_skills': [s.strip().lower() for s in row['matching_skills'].split(',')] if row['matching_skills'] else [],
            'study_time': row['study_time'].strip() if row['study_time'] else 'TBD',
            'status': row['status']
        }
        for row in cursor.fetchall()
    ]
    conn.close()
    logging.debug(f"Fetched existing groups: {len(groups)}")
    return groups

def get_user_profiles():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, email, skills, availability FROM users")
    profiles = [
        {
            'id': row['id'],
            'name': row['name'].strip(),
            'email': row['email'],
            'skills': [s.strip().lower() for s in row['skills'].split(',')] if row['skills'] else [],
            'availability': [a.strip() for a in row['availability'].split(',')] if row['availability'] else ['TBD']
        }
        for row in cursor.fetchall()
    ]
    conn.close()
    logging.debug(f"Fetched user profiles: {len(profiles)}")
    return profiles

def match_student_to_group(student_profile, groups):
    student_skills = set(s.lower() for s in student_profile['skills'])
    student_availability = set(a.strip() for a in student_profile['availability']) or {'TBD'}
    
    best_match = None
    max_common_skills = 0
    
    for group in groups:
        group_skills = set(s.lower() for s in group['matching_skills'])
        group_availability = set(group['study_time'].split(',')) if group['study_time'] else {'TBD'}
        common_skills = student_skills & group_skills
        
        availability_match = 'TBD' in student_availability or 'TBD' in group_availability or bool(student_availability & group_availability)
        
        if common_skills and availability_match:
            if len(common_skills) > max_common_skills:
                best_match = group
                max_common_skills = len(common_skills)
    
    if not best_match:
        group_id = len(groups) + 1
        best_match = {
            'id': group_id,
            'name': f"Group-{uuid.uuid4().hex[:8]}",
            'members': [student_profile['name']],
            'matching_skills': list(student_skills),
            'study_time': ','.join(student_availability) if student_availability else 'TBD',
            'status': 'active'
        }
        save_group(best_match)
        logging.debug(f"Created solo group for {student_profile['name']}: {best_match['name']}")
    
    return best_match

def save_group(group_data, retry_count=3):
    conn = get_db_connection()
    cursor = conn.cursor()
    attempt = 0
    original_name = group_data['name']
    
    while attempt < retry_count:
        try:
            cursor.execute(
                """
                INSERT OR REPLACE INTO groups (name, members, matching_skills, study_time, status)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    group_data['name'],
                    ','.join(group_data['members']),
                    ','.join(group_data['matching_skills']),
                    group_data['study_time'],
                    group_data['status']
                )
            )
            group_id = cursor.lastrowid
            conn.commit()
            logging.debug(f"Saved group: {group_data['name']} with members {group_data['members']}")
            return group_id
        except sqlite3.IntegrityError as e:
            logging.warning(f"IntegrityError on attempt {attempt + 1} for group {group_data['name']}: {str(e)}")
            attempt += 1
            group_data['name'] = f"{original_name}-{uuid.uuid4().hex[:8]}"
        finally:
            conn.close()
            conn = get_db_connection()
            cursor = conn.cursor()
    
    logging.error(f"Failed to save group after {retry_count} attempts: {original_name}")
    conn.close()
    return None

def vectorize_skills(profiles):
    skills = [' '.join(profile['skills']) for profile in profiles]
    vectorizer = TfidfVectorizer(lowercase=True)
    X = vectorizer.fit_transform(skills)
    return X, vectorizer

def find_common_availability(cluster_profiles):
    availability_sets = [set(profile['availability']) for profile in cluster_profiles if profile['availability'] and profile['availability'] != ['TBD']]
    if not availability_sets:
        return 'TBD'
    common = set.intersection(*availability_sets)
    return ','.join(common) if common else ','.join(availability_sets[0])

def initialize_groups():
    profiles = get_user_profiles()
    existing_groups = get_existing_groups()
    grouped_user_emails = set()
    for group in existing_groups:
        for profile in profiles:
            if profile['name'].strip().lower() in [m.strip().lower() for m in group['members']]:
                grouped_user_emails.add(profile['email'])
    
    unmatched_profiles = [p for p in profiles if p['email'] not in grouped_user_emails]
    logging.debug(f"Unmatched profiles: {len(unmatched_profiles)}")
    
    if not unmatched_profiles:
        return
    
    for profile in unmatched_profiles:
        if not profile['skills']:
            group_data = {
                'name': f"Group-{uuid.uuid4().hex[:8]}",
                'members': [profile['name']],
                'matching_skills': [],
                'study_time': ','.join(profile['availability']) if profile['availability'] else 'TBD',
                'status': 'active'
            }
            save_group(group_data)
            logging.debug(f"Created solo group for {profile['name']}: {group_data['name']}")
    
    skill_groups = defaultdict(list)
    valid_profiles = [p for p in unmatched_profiles if p['skills']]
    logging.debug(f"Valid profiles with skills: {len(valid_profiles)}")
    
    for profile in valid_profiles:
        skills_key = tuple(sorted(profile['skills']))
        skill_groups[skills_key].append(profile)
    
    for skills_key, cluster_profiles in skill_groups.items():
        skills = set(skills_key)
        study_time = find_common_availability(cluster_profiles)
        members = [profile['name'] for profile in cluster_profiles]
        
        group_data = {
            'name': f"Group-{uuid.uuid4().hex[:8]}",
            'members': members,
            'matching_skills': list(skills),
            'study_time': study_time,
            'status': 'active'
        }
        save_group(group_data)
        logging.debug(f"Saved group for skills {skills}: {group_data['name']} with {len(members)} members")
    
    remaining_profiles = [p for p in valid_profiles if tuple(sorted(p['skills'])) not in skill_groups]
    logging.debug(f"Remaining profiles for KMeans: {len(remaining_profiles)}")
    
    if len(remaining_profiles) >= 1:
        X, vectorizer = vectorize_skills(remaining_profiles)
        n_clusters = max(1, len(remaining_profiles) // 2)
        kmeans = KMeans(n_clusters=n_clusters, n_init=10, random_state=42)
        labels = kmeans.fit_predict(X)
        
        clusters = defaultdict(list)
        for profile, label in zip(remaining_profiles, labels):
            clusters[label].append(profile)
        
        for cluster_id, cluster_profiles in clusters.items():
            skills = [set(profile['skills']) for profile in cluster_profiles]
            common_skills = set.intersection(*skills) if len(skills) > 1 else skills[0]
            if not common_skills:
                all_skills = set().union(*skills)
                common_skills = list(all_skills)[:1]
            else:
                common_skills = list(common_skills)[:2]
            
            study_time = find_common_availability(cluster_profiles)
            members = [profile['name'] for profile in cluster_profiles]
            
            group_data = {
                'name': f"Group-{uuid.uuid4().hex[:8]}",
                'members': members,
                'matching_skills': list(common_skills),
                'study_time': study_time,
                'status': 'active'
            }
            save_group(group_data)
            logging.debug(f"Saved KMeans group: {group_data['name']} with {len(members)} members")