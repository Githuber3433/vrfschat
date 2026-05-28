const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

const USERS_DB = path.join(__dirname, '../../users.json');

function getUsers() {
    if (!fs.existsSync(USERS_DB)) {
        fs.writeFileSync(USERS_DB, JSON.stringify({}));
    }
    return JSON.parse(fs.readFileSync(USERS_DB));
}

function saveUsers(users) {
    fs.writeFileSync(USERS_DB, JSON.stringify(users, null, 2));
}

async function getCountryFromIP(ip) {
    try {
        if (ip === '::1' || ip === '127.0.0.1' || ip === 'localhost') {
            return 'Localhost';
        }
        const fetch = require('node-fetch');
        const response = await fetch(`http://ip-api.com/json/${ip}`);
        const data = await response.json();
        if (data.status === 'success' && data.country) {
            return data.country;
        }
        return 'Unknown';
    } catch (err) {
        return 'Unknown';
    }
}

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method not allowed' };
    }

    const { uid, password, username } = JSON.parse(event.body);

    if (!uid || !password || !username) {
        return { statusCode: 400, body: JSON.stringify({ error: "Missing fields" }) };
    }

    const users = getUsers();
    if (users[uid]) {
        return { statusCode: 400, body: JSON.stringify({ error: "UID already registered" }) };
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const country = await getCountryFromIP(event.headers['x-forwarded-for'] || event.headers['client-ip']);

    users[uid] = {
        uid,
        password: hashedPassword,
        username,
        verified: false,
        createdAt: new Date().toISOString(),
        country: country,
        online: false
    };

    saveUsers(users);

    return {
        statusCode: 200,
        body: JSON.stringify({ success: true, uid, username }),
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': 'true'
        }
    };
};
