/**
 * Brand marks for the three self-hosted instances (Ever fork).
 *
 * Inlined as SVG rather than <img>: these must render before any network round-trip
 * and must recolour with the theme (the ever.co wordmark is `fill-current`).
 *
 * ever.co   - the "ever®" wordmark, taken verbatim from ever.co
 * ever.works - the Ever Works gradient mark, taken verbatim from ever.works
 * cloc      - a typographic wordmark; Cloc has no published logo yet (cloc.com is
 *             still the under-construction page), so inventing a mark would be worse
 *             than setting the name cleanly. Swap this out when brand assets exist.
 */
import type { BrandId } from "../helpers/brand"
import { BRANDS } from "../helpers/brand"

/*
 * viewBox is measured from the paths, NOT copied from ever.co.
 * ever.co ships this mark as viewBox="0 0 60 45" with transform="translate(-30 10)",
 * which crops a 60-wide window out of a wordmark that is actually 111 x 25 units —
 * on their page other CSS compensates, but standalone it renders as a sliced "ue1".
 * Measured bbox: x -0.01, y -0.01, w 111.01, h 25.01; +2 units of padding.
 */
const EverCoMark: React.FC<{ className?: string }> = ({ className }) => (
    <svg viewBox="-2 -2 115 29" className={className} role="img" aria-label="Ever">
        <g className="fill-current">
            <path d="M66.555,24.8a13.625,13.625,0,0,1-4.8-.8,9.237,9.237,0,0,1-3.415-2.2A10.477,10.477,0,0,1,55.62,14.31,14.372,14.372,0,0,1,59.631,4.151,14.187,14.187,0,0,1,69.885,0a9.82,9.82,0,0,1,6.851,2.3A7.7,7.7,0,0,1,79.065,8.1a15.708,15.708,0,0,1-1.44,6.165h-14a3.552,3.552,0,0,0,.971,2.629,4.872,4.872,0,0,0,3.574,1.241,13.484,13.484,0,0,0,6.345-2.07l2.25,5.94A19.19,19.19,0,0,1,66.555,24.8ZM69.48,6.165a5.041,5.041,0,0,0-4.9,3.42h7.6a3.806,3.806,0,0,0,.225-1.17C72.405,7.027,71.284,6.165,69.48,6.165ZM10.935,24.8a13.625,13.625,0,0,1-4.8-.8,9.237,9.237,0,0,1-3.415-2.2A10.477,10.477,0,0,1,0,14.31,14.372,14.372,0,0,1,4.011,4.151,14.187,14.187,0,0,1,14.265,0a9.82,9.82,0,0,1,6.851,2.3A7.7,7.7,0,0,1,23.445,8.1a15.708,15.708,0,0,1-1.44,6.165H8.01a3.552,3.552,0,0,0,.971,2.629,4.872,4.872,0,0,0,3.574,1.241,13.484,13.484,0,0,0,6.345-2.07l2.25,5.94A19.19,19.19,0,0,1,10.935,24.8ZM13.86,6.165a5.041,5.041,0,0,0-4.905,3.42H16.56a3.806,3.806,0,0,0,.225-1.17C16.785,7.027,15.664,6.165,13.86,6.165Zm24.39,18.45c-3.728,0-6.422-.957-8.007-2.844-1.5-1.782-1.967-4.337-1.4-7.6l.81-4.725c.176-.88.145-1.405-.1-1.7a.859.859,0,0,0-.711-.276,5.584,5.584,0,0,0-2.2.495l.945-6.84a15.538,15.538,0,0,1,5.58-.9c2.083,0,3.594.544,4.492,1.618.985,1.178,1.26,3.026.818,5.492l-.99,5.49c-.254,1.609-.119,2.694.412,3.316a1.9,1.9,0,0,0,1.523.6,3.306,3.306,0,0,0,3.054-1.71c.761-1.274,1.131-3.246,1.131-6.03A34.578,34.578,0,0,0,42.435.63H51.39a48.6,48.6,0,0,1,.675,7.56C52.065,18.782,47.159,24.615,38.25,24.615Zm53.5-.45H83.34L85.905,9.45a2.351,2.351,0,0,0-.125-1.723A.844.844,0,0,0,85.1,7.47a7.2,7.2,0,0,0-2.25.495l.99-6.84a17.294,17.294,0,0,1,5.625-.9,6.6,6.6,0,0,1,3.426.793A4,4,0,0,1,94.725,3.6,6.823,6.823,0,0,1,100.71.225a8.314,8.314,0,0,1,3.96.945l-2.385,7.92a10.011,10.011,0,0,0-4.275-.945c-2.732,0-3.738,2.34-4.1,3.735l-2.16,12.284Z" />
            <g transform="translate(101 15)">
                <path d="M0,5a5,5,0,1,1,5,5A5.006,5.006,0,0,1,0,5ZM.667,5A4.333,4.333,0,1,0,5,.667,4.338,4.338,0,0,0,.667,5ZM3.4,7.5H2.713l.926-5.332,1.6,0A1.8,1.8,0,0,1,6.521,2.6a1.333,1.333,0,0,1,.37,1.147,1.526,1.526,0,0,1-.365.882,2.012,2.012,0,0,1-.862.575l.827,2.253,0,.046H5.756L5.009,5.343H3.778L3.4,7.5h0Zm.473-2.732,1.011,0a1.424,1.424,0,0,0,.89-.28A1.1,1.1,0,0,0,6.2,3.743a.867.867,0,0,0-.184-.718.983.983,0,0,0-.725-.274l-1.066,0Z" />
            </g>
        </g>
    </svg>
)

const EVER_WORKS_PATH =
    "M0.301305 30.0417L0.581185 29.3889L4.20635 20.9338L4.20144 20.9242L0.334577 13.3102L0.0104603 12.6721L0.71239 12.4846L9.19627 10.2172L13.1922 1.54579L13.4927 0.893555L14.0859 1.31128L22.1152 6.96599L31.5808 4.42609L32.3695 4.21448L32.336 5.01473L31.9353 14.6145L39.3953 20.0675L40 20.5095L39.4223 20.9851L32.259 26.8807V26.8843L32.243 26.8973L31.9502 36.4851L31.9289 37.179L31.2344 37.0415L22.0143 35.2168L15.0316 40.6565L14.4535 41.1069L14.1245 40.4591L9.84483 32.0334L9.83811 32.0214L1.00836 30.1884L0.301305 30.0417ZM1.96323 29.1895L4.90946 22.3182L9.15843 30.6832L1.96323 29.1895ZM10.6516 30.9931L10.6745 31.0382L21.7022 33.9188L31.048 26.3458L30.7375 15.2001L30.7151 15.1837L30.7182 15.1073L21.8593 8.24458L10.05 11.2081L5.52582 20.9027L10.6516 30.9931ZM14.8657 39.2896L11.3843 32.4357L20.5803 34.8377L14.8657 39.2896ZM30.7765 35.7562L23.1683 34.2506L31.0167 27.8909L30.7765 35.7562ZM38.0756 20.5639L32.2172 25.3857L31.9583 16.0925L38.0756 20.5639ZM31.1081 5.7671L30.7787 13.6611L23.2948 7.86365L31.1081 5.7671ZM13.9812 2.67982L20.6111 7.34897L10.6813 9.84084L13.9812 2.67982ZM1.72897 13.4267L8.55107 11.6035L4.84103 19.5536L1.72897 13.4267ZM38.8031 18.0737L33.1326 6.90982L32.7945 7.07455L38.4651 18.2384L38.8031 18.0737ZM15.8809 1.53828L29.1717 4.18404L29.0965 4.54643L15.8057 1.90068L15.8809 1.53828ZM2.31222 10.6603L11.1714 2.64427L10.9153 2.37262L2.05606 10.3887L2.31222 10.6603ZM0.677161 15.1468L0.377393 27.2163L0 27.2072L0.29976 15.1379L0.677161 15.1468ZM12.6515 39.1303L2.54456 31.3383L2.3111 31.6289L12.4181 39.4208L12.6515 39.1303ZM29.3893 38.1013L17.4202 40.8246L17.3348 40.4644L29.3039 37.7409L29.3893 38.1013ZM32.8416 34.9313L38.7593 22.992L38.4196 22.8304L32.5019 34.7697L32.8416 34.9313Z"

const EverWorksMark: React.FC<{ className?: string }> = ({ className }) => (
    <svg viewBox="0 0 40 42" fill="none" className={className} role="img" aria-label="Ever Works">
        {/* Base fill keeps the mark legible on both themes before the gradient paints. */}
        <path fillRule="evenodd" clipRule="evenodd" d={EVER_WORKS_PATH} className="fill-current" />
        <path fillRule="evenodd" clipRule="evenodd" d={EVER_WORKS_PATH} fill="url(#ew-mark-gradient)" />
        <defs>
            <linearGradient id="ew-mark-gradient" x1="0.8" y1="7" x2="40.6" y2="7.8" gradientUnits="userSpaceOnUse">
                <stop stopColor="#FF1CF7" />
                <stop offset="1" stopColor="#00F0FF" />
            </linearGradient>
        </defs>
    </svg>
)

const ClocMark: React.FC<{ className?: string }> = ({ className }) => (
    <svg viewBox="0 0 40 40" className={className} role="img" aria-label="Cloc">
        <circle cx="20" cy="20" r="18" fill="none" stroke="url(#cloc-mark-gradient)" strokeWidth="3" />
        {/* Clock hands — Cloc is a time product. */}
        <path d="M20 10v11l7 4" fill="none" stroke="url(#cloc-mark-gradient)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <defs>
            <linearGradient id="cloc-mark-gradient" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
                <stop stopColor="#2DD4BF" />
                <stop offset="1" stopColor="#3B82F6" />
            </linearGradient>
        </defs>
    </svg>
)

const MARKS: Record<BrandId, React.FC<{ className?: string }>> = {
    "ever-co": EverCoMark,
    "ever-works": EverWorksMark,
    cloc: ClocMark,
}

interface Props {
    brandId: BrandId
    /** Show the brand name next to the mark. The ever.co mark is already a wordmark. */
    withName?: boolean
    className?: string
}

const BrandLogo: React.FC<Props> = ({ brandId, withName = true, className = "" }) => {
    const Mark = MARKS[brandId]
    const brand = BRANDS[brandId]
    // ever.co's mark IS the word "ever", so repeating the name beside it reads badly.
    const showName = withName && brandId !== "ever-co"

    return (
        <span className={`inline-flex items-center gap-2 ${className}`}>
            <Mark className={brandId === "ever-co" ? "h-7 w-auto" : "h-7 w-7 shrink-0"} />
            {showName && (
                <span className="text-base font-semibold tracking-tight whitespace-nowrap">{brand.name}</span>
            )}
        </span>
    )
}

export default BrandLogo
