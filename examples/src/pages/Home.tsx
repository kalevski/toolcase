import { Link } from 'react-router'

const packages = [
    {
        name: '@toolcase/base',
        description: 'Collection of JavaScript helper functions and structures',
        path: '/base',
        icon: 'bi-tools',
    },
    {
        name: '@toolcase/react-components',
        description: '81+ React UI components built on Bootstrap 5',
        path: '/react-components',
        icon: 'bi-grid-3x3-gap',
    },
]

export const Home = () => {
    return (
        <div className="home">
            <div className="home__header">
                <h1>@toolcase</h1>
                <p>A modular TypeScript toolkit — utilities, components, and more.</p>
            </div>
            <div className="home__grid">
                {packages.map((pkg) => (
                    <Link key={pkg.name} to={pkg.path} className="home__card">
                        <i className={`bi ${pkg.icon} home__card-icon`}></i>
                        <h2>{pkg.name}</h2>
                        <p>{pkg.description}</p>
                    </Link>
                ))}
            </div>
        </div>
    )
}
