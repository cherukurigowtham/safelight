export function generateCaptcha(level = 1) {
    const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
    let a, b, answer;

    if (level === 1) {
        a = rand(1, 10); b = rand(1, 10); answer = a + b;
    } else if (level === 2) {
        a = rand(10, 50); b = rand(1, 10); answer = a - b;
    } else {
        a = rand(2, 10); b = rand(2, 5); answer = a * b;
    }

    return { question: `${a} ? ${b}`, answer };
}

export function verifyCaptcha(expected, received) {
    return Number(expected) === Number(received);
}
