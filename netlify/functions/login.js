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

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method not allowed' };
    }

    const { uid, password } = JSON.parse(event.body);

    if (!uid || !password) {
        return { statusCode: 400, body: JSON.stringify({ error: "Missing fields" }) };
    }

    const users = getUsers();
    const user = users[uid];

    if (!user) {
        return { statusCode: 400, body: JSON.stringify({ error: "User not found" }) };
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
        return { statusCode: 400, body: JSON.stringify({ error: "Invalid password" }) };
    }

    return {
        statusCode: 200,
        body: JSON.stringify({ success: true, uid, username: user.username, verified: user.verified }),
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': 'true'
        }
    };
};
