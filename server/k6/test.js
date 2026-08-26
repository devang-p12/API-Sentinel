import http from 'k6/http';

export default function () {
    http.get('https://dummyjson.com/products?delay=1000');
}