import React, { useEffect, useState } from 'react';

export const FadeTransition = ({ show, children, duration = 200 }) => {
    const [render, setRender] = useState(show);
    const [opacity, setOpacity] = useState(show ? 1 : 0);

    useEffect(() => {
        let timeoutId;
        if (show) {
            setRender(true);
            timeoutId = setTimeout(() => setOpacity(1), 10);
        } else {
            setOpacity(0);
            timeoutId = setTimeout(() => setRender(false), duration);
        }
        return () => clearTimeout(timeoutId);
    }, [show, duration]);

    if (!render) return null;

    return (
        <div
            style={{
                transition: `opacity ${duration}ms ease-in-out`,
                opacity: opacity
            }}
        >
            {children}
        </div>
    );
};

export default FadeTransition;