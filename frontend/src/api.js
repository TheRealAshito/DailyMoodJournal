import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
})

api.interceptors.response.use(
  (r) => r,
  (error) => {
    return Promise.reject(error)
  }
)

export default api
